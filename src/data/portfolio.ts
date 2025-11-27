export interface Portfolio {
  title: string;
  description: string;
  technologies?: string[];
  imageUrl?: string;
  projectUrl?: string;
  codeUrl?: string;
}

export const portfolioData: Portfolio[] = [
  {
    title: "TorchGeo",
    description:
      "A PyTorch domain library, similar to torchvision, providing datasets, samplers, transforms, and pre-trained models specific to geospatial data.",
    technologies: ["PyTorch", "Geospatial", "Remote Sensing"],
    projectUrl: "https://torchgeo.readthedocs.io/en/latest/",
    imageUrl: "https://raw.githubusercontent.com/microsoft/torchgeo/main/logo/logo-color.svg",
    codeUrl: "https://github.com/microsoft/torchgeo/",
  },
  {
    title: "Segmentation Models PyTorch",
    description:
      "A library containing a suite of PyTorch-based semantic segmentation decoders along with pretrained timm encoder support.",
    technologies: ["Python", "PyTorch", "Semantic Segmentation"],
    imageUrl: "https://raw.githubusercontent.com/qubvel-org/segmentation_models.pytorch/refs/heads/main/docs/logo.png",
    codeUrl: "https://github.com/qubvel-org/segmentation_models.pytorch",
  },
  {
    title: "Fields of the World (FTW)",
    description:
      "A library for advancing machine learning models for instance segmentation of agricultural field boundaries in multispectral satellite imagery.",
    technologies: ["Python", "PyTorch", "Field Boundary Segmentation"],
    imageUrl: "https://raw.githubusercontent.com/fieldsoftheworld/fieldsoftheworld.github.io/refs/heads/main/static/images/ftw_logo.png",
    codeUrl: "https://github.com/fieldsoftheworld/ftw-baselines",
  },
];
