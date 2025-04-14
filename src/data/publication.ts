export interface Publication {
  year: string;
  conference: string;
  title: string;
  authors: string;
  paperUrl?: string;
  codeUrl?: string;
  bibtex?: string;
  tldr?: string;
  imageUrl?: string;
  award?: string;
}

export const publicationData: Publication[] = [
  {
    year: "2025",
    conference: "CVPR PBVS",
    title: "Aerial Infrared Health Monitoring of Solar Photovoltaic Farms at Scale",
    authors: "Isaac Corley, Conor Wallace, Sourav Agrawal, Burton Putrah, Jonathan Lwowski",
    paperUrl: "https://arxiv.org/abs/2503.02128",
    tldr: "We collect large-scale aerial infrared dataset of 6k+ solar farms across the continental U.S. and detail our end-to-end pipeline for detecting anomalies and estimating plant-level power loss due to defective panels.",
    imageUrl: "/images/nass.jpg",
  },
  {
    year: "2024",
    conference: "WACV CV4EO",
    title: "FLAVARS: A Multimodal Foundational Language and Vision Alignment Model for Remote Sensing",
    authors: "Isaac Corley, Simone Fobi Nsutezo, Anthony Ortiz, Caleb Robinson, Rahul Dodhia, Juan M. Lavista Ferres, Peyman Najafirad",
    paperUrl: "https://arxiv.org/abs/2501.08490",
    codeUrl: "https://huggingface.co/datasets/isaaccorley/FLAVARS",
    tldr: "We find that pretraining using CLIP+MAE+MLM+SatCLIP objectivers provides better balance for dense vision tasks over pure CLIP and FLAVA pretraining.",
    imageUrl: "/images/flavars.jpg",
  },
  {
    year: "2024",
    conference: "ICLR ML4RS",
    title: "A Change Detection Reality Check",
    authors: "Isaac Corley, Caleb Robinson, Anthony Ortiz",
    paperUrl: "https://arxiv.org/abs/2402.06994",
    codeUrl: "https://github.com/isaaccorley/a-change-detection-reality-check",
    tldr: "We find a U-Net baseline (2015) is still a top performer on change detection benchmarks.",
    imageUrl: "/images/levircd.jpg",
  },
  {
    year: "2024",
    conference: "IROS",
    title: "Barely-Visible Surface Crack Detection for Wind Turbine Sustainability",
    authors: "Sourav Agrawal, Isaac Corley, Conor Wallace, Clovis Vaughn, Jonathan Lwowski",
    paperUrl: "https://arxiv.org/abs/2407.07186",
    tldr: "We present a novel dataset and pipeline for detecting barely-visible surface cracks on wind turbine blades.",
    imageUrl: "/images/turbine-cracks.jpg",
    award: "🏆 Best Application Paper Runner-Up"
  },
  {
    year: "2024",
    conference: "ECCV CV4E",
    title: "Depth Any Canopy: Leveraging Depth Foundation Models for Canopy Height Estimation",
    authors: "Daniele Rege Cambrin, Isaac Corley, Paolo Garza",
    paperUrl: "https://arxiv.org/abs/2408.04523",
    codeUrl: "https://github.com/DarthReca/depth-any-canopy",
    tldr: "We efficiently adapt sota monocular depth estimation models for tree canopy height estimation in aerial & satellite imagery.",
    imageUrl: "/images/depth-any-canopy.jpg",
  },
  {
    year: "2024",
    conference: "WACV",
    title: "ZRG: A Dataset for Multimodal 3D Residential Rooftop Understanding",
    authors: "Isaac Corley, Jonathan Lwowski, Peyman Najafirad",
    paperUrl: "https://arxiv.org/abs/2304.13219",
    codeUrl: "https://github.com/isaaccorley/zrg-dataset",
    tldr: "We present a novel large-scale dataset for 3D understanding of residential roofs using orthomosaics, DSMs, and 3D roof wireframes.",
    imageUrl: "/images/zrg.jpg",
  },
  {
    year: "2024",
    conference: "IGARSS",
    title: "Seeing the roads through the trees: A benchmark for modeling spatial dependencies with aerial imagery",
    authors: "Caleb Robinson, Isaac Corley, Anthony Ortiz, Rahul Dodhia, Juan M. Lavista Ferres, Peyman Najafirad",
    paperUrl: "https://arxiv.org/abs/2401.06762",
    codeUrl: "https://github.com/isaaccorley/ChesapeakeRSC",
    tldr: "We introduce a novel dataset for evaluating a model's ability to use long-range spatial context by performing road extraction in aerial imagery with high amounts of occlusion by tree canopy.",
    imageUrl: "/images/chesapeake-rsc.jpg",
  },
  {
    year: "2024",
    conference: "CVPR PBVS",
    title: "Revisiting Pre-trained Remote Sensing Model Benchmarks: Resizing and Normalization Matters",
    authors: "Isaac Corley, Caleb Robinson, Rahul Dodhia, Juan M. Lavista Ferres, Peyman Najafirad",
    paperUrl: "https://arxiv.org/abs/2305.13456",
    codeUrl: "https://github.com/isaaccorley/resize-is-all-you-need",
    tldr: "We perform a comprehensive benchmark of geospatial foundation models and find that they are highly sensitive to pretrained image size and normalization.",
    imageUrl: "/images/resize-is-all-you-need.jpg",
  },
  {
    year: "2023",
    conference: "NeurIPS",
    title: "SSL4EO-L: Datasets and Foundation Models for Landsat Imagery",
    authors: "Adam J. Stewart, Nils Lehmann, Isaac A. Corley, Yi Wang, Yi-Chia Chang, Nassim Ait Ali Braham, Shradha Sehgal, Caleb Robinson, Arindam Banerjee",
    paperUrl: "https://arxiv.org/abs/2306.09424",
    codeUrl: "https://torchgeo.readthedocs.io/en/stable/",
    tldr: "We introduce SSL4EO-L, the first ever dataset designed for self-supervised learning for Earth Observation for the Landsat family of satellites.",
    imageUrl: "/images/ssl4eol.jpg",
  },
  {
    year: "2022",
    conference: "ACM SIGSPATIAL",
    title: "TorchGeo: Deep Learning with Geospatial Data",
    authors: "Adam J. Stewart, Caleb Robinson, Isaac A. Corley, Anthony Ortiz, Juan M. Lavista Ferres, Arindam Banerjee",
    paperUrl: "https://arxiv.org/abs/2111.08872",
    codeUrl: "https://torchgeo.readthedocs.io/en/stable/",
    tldr: "We introduce TorchGeo, a Python library for integrating geospatial data into the PyTorch deep learning ecosystem.",
    imageUrl: "/images/torchgeo.jpg",
    award: "🏆 Best Paper Runner-Up"
  },
  {
    year: "2022",
    conference: "ICIP",
    title: "Supervising Remote Sensing Change Detection Models with 3D Surface Semantics",
    authors: "Isaac Corley, Peyman Najafirad",
    paperUrl: "https://arxiv.org/abs/2202.13251",
    codeUrl: "https://github.com/isaaccorley/contrastive-surface-image-pretraining",
    tldr: "We propose Contrastive Surface-Image Pretraining (CSIP) for joint learning a latent space which extracts surface level features from optical RGB imagery.",
    imageUrl: "/images/csip.jpg",
  },
];
