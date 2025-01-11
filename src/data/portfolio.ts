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
    title: "TorchSeg",
    description:
      "An up-to-date fork of the segmentation-models.pytorch (smp) library with added features like complete timm ViT backbone support, and more thorough testing/linting/code coverage.",
    technologies: ["Python", "PyTorch", "Semantic Segmentation"],
    imageUrl: "https://raw.githubusercontent.com/qubvel-org/segmentation_models.pytorch/refs/heads/main/docs/logo.png",
    codeUrl: "https://github.com/isaaccorley/torchseg",
  },
  {
    title: "PyTorch Enhance",
    description:
      "A PyTorch domain library of implementations of deep learning-based image super-resolution methods.",
    technologies: ["Python", "PyTorch", "Image Super-Resolution"],
    imageUrl: "https://raw.githubusercontent.com/isaaccorley/pytorch-enhance/refs/heads/master/assets/pytorch-enhance-logo.png",
    codeUrl: "https://github.com/isaaccorley/pytorch-enhance/tree/master",
  },
];
