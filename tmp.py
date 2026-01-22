from torchgeo.datasets import EarthIndexEmbeddings, Sentinel2
from torchgeo.models import ViTSmall14_DINOv2_Weights, vit_small_patch14_dinov2
from torch.nn import CosineSimilarity

model = vit_small_patch14_dinov2(
    ViTSmall14_DINOv2_Weights.SENTINEL2_ALL_SOFTCON
)
cos = CosineSimilarity()

eie = EarthIndexEmbeddings(root)
s2 = Sentinel2(paths)

sample = s2[xmin:xmax, ymin:ymax]
query = model(sample)

best = None
best_dist = 2**10
for sample in eie:
    dist = cos(query, sample["embedding"])
    if dist < best_dist:
        best_dist = dist
        best = (sample["x"], sample["y"])