---
title: "AlphaEarth Embedding EuroSAT Eval"
date: "2024-01-15"
description: "Experimental work on exporting Google AlphaEarth embeddings for EuroSAT remote sensing benchmark to evaluate AlphaEarth against other Geospatial Foundation Models"
tags: ["alphaearth", "geospatial-foundation-models", "embeddings"]
---

I don't tend to write blogs, however I thought it would be an interesting exercise to log some small experiments I've done to evaluate [Google's AlphaEarth (AEF) embeddings](https://deepmind.google/discover/blog/alphaearth-foundations-helps-map-our-planet-in-unprecedented-detail/) by extracting the AEF pixel embeddings which align with the Sentinel-2 imagery in the EuroSAT dataset.

[EuroSAT](https://github.com/phelber/EuroSAT) is a canonical classification benchmark dataset in remote sensing, particularly for showing performance of geospatial foundation models, however it was oddly left out of the [AlphaEarth paper](https://arxiv.org/abs/2507.22291) for reasons. 

In this blog I'll show the steps I took for creating the dataset using a combination of GEE + TorchGeo, and then some evals to see how AEF stacks up to other GFMs.

## Creating the Dataset

The [AlphaEarth-EuroSAT dataset](https://huggingface.co/datasets/isaaccorley/AlphaEarth-EuroSAT) contains 27k samples, each representing a ~64x64 pixel Sentinel-2 patch from the EuroSAT dataset with corresponding AlphaEarth embeddings. This dataset serves as a standardized benchmark for comparing AlphaEarth against other foundation models in the geospatial domain.


```shell
pip install torchgeo xee rioxarray tqdm
```

```python
import ee
import xarray as xr
import rioxarray as rio
from torchgeo.datasets import EuroSAT
from concurrent.futures import ThreadPoolExecutor
from functools ipmort partial
import tqdm
```

### Quantization

The AEF embeddings are stored as `float32` however it was mentioned in the [paper](https://arxiv.org/abs/2507.22291) (see `section S8.1`) that they can be quantized down `int8` to save on storage space while retaining performance. For simplicity, will quantize and add `127` to store as `uint8` instead. We can also offload these quick maths to GEE ops before actually downloading the data.

```python
def quantize_aef(image):
    quantized = image.abs().pow(ee.Number(1.0).divide(2.0)).multiply(image.signum())
    quantized = quantized.multiply(127.5).round()
    return quantized.clamp(-127, 127).add(127).uint8()
```

### Downloading AEF Embeddings from GEE

The code is pretty self-explanatory, but the important bits are **a)** we use [Xee](https://github.com/google/Xee) to download directly to xarray **b)** we use the [GEE high-volume endpoint](https://developers.google.com/earth-engine/guides/processing_environments#high-volume_endpoint) instead of the batch one **c)** we parallelize the download using multithreading and **d)** we use [TorchGeo's](https://github.com/torchgeo/torchgeo) `EuroSAT` implementation to automatically download the dataset and the proper splits for performing our evals.

```python
ee.Initialize(
    project="aef-eurosat,
    opt_url="https://earthengine-highvolume.googleapis.com",
)
collection = ee.ImageCollection("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL")
```

Now we can automagically download the EuroSAT dataset using TorchGeo and list all the image paths. 

```python
filepaths = []
for split in ["train", "val", "test"]:
    ds = EuroSAT(root=args.root, split=split, download=True, checksum=True)
    filepaths.extend([Path(img) for img, _ in ds.imgs])
```

We then create a simple function that loads a EuroSAT patch and uses the patch bounds to filter the AEF collection. Unfortunately EuroSAT didn't contain timestamps for the patches so we will assume it's sometime in the year of [publication](https://ieeexplore.ieee.org/abstract/document/8519248) in 2018.

```python
def download_aef(filepath, output, year, collection):
    raster = rio.open_rasterio(filepath).rio.reproject("EPSG:4326")
    bounds = raster.rio.bounds()
    geometry = ee.Geometry.BBox(*bounds)

    startDate = ee.Date.fromYMD(year, 1, 1)
    endDate = startDate.advance(1, "year")
    
    image = (
        collection.filter(ee.Filter.date(startDate, endDate))
        .filter(ee.Filter.bounds(geometry))
        .first()
    )
    image = quantize_aef(image)
    projection = image.select(0).projection()
    
    ds = xr.open_dataset(
        image,
        engine="ee",
        geometry=bounds,
        projection=projection,
    )
    ds = ds.isel(time=0).rename({"X": "x", "Y": "y"})
    ds = ds.to_array(dim="band").transpose("band", "y", "x")
    
    output_path = os.path.join(output, filepath.stem + ".tif")
    ds.rio.to_raster(output_path, driver="COG", compress="deflate", dtype="uint8")
```

Now for some multithreading magic.

```python
func = partial(download_aef, output=args.output, year=args.year, collection=collection)

with ThreadPoolExecutor(max_workers=args.num_workers) as executor:
    futures = [executor.submit(func, filepath) for filepath in filepaths]

    list(tqdm(
        concurrent.futures.as_completed(futures), total=len(filepaths)
    ))
```