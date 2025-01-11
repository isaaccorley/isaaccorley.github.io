export interface Experience {
  date: string;
  title: string;
  company: string;
  description?: string;
  advisor?: string;
  manager?: string;
  companyUrl?: string;
}

export const experienceData: Experience[] = [
    {
      "date": "2021 - Present",
      "title": "Senior Machine Learning Scientist",
      "company": "Zeitview (formerly DroneBase)",
      "description": "Research, develop, train, and deployed computer vision, vision-language models (VLM), and 3D Reconstruction methods at scale for enhancing renewable energy inspections and analytics, including solar farms, wind turbines, commercial and residential rooftops, transmission and distribution stations, and telecom towers.",
      "companyUrl": "https://www.zeitview.com/"
    },
    {
      "date": "2024",
      "title": "Ph.D. Research Intern",
      "company": "Microsoft Research",
      "advisor": "Simone Fobi Nsutezo & Anthony Ortiz",
      "description": "Researched multimodal pretraining methods for large-scale geospatial vision-language datasets.",
      "companyUrl": "https://www.microsoft.com/en-us/research/group/ai-for-good-research-lab/"
    },
    {
      "date": "2022 - 2023",
      "title": "Ph.D. Research Intern",
      "company": "SLB (formerly Schlumberger)",
      "description": "Researched using deep learning to estimate global xCO2 using in-situ ODIAC Fossil fuel emissions and OCO-2 and GOSAT-2 datasets.",
      "companyUrl": "https://www.slb.com/products-and-services/delivering-digital-at-scale/artificial-intelligence-solutions",
      "advisor": "Abhinav Kohar"
    },
    {
      "date": "2021 - 2022",
      "title": "Senior Machine Learning Engineer",
      "company": "Spruce",
      "description": "Applied state-of-the-art Optical Character Recognition (OCR) and Text Summarization methods to parse real estate and financial documents.",
      "companyUrl": "https://marketing.spruce.co/"
    },
    {
      "date": "2021 - 2022",
      "title": "Senior Machine Learning Engineer",
      "company": "BlackSky",
      "description": "Developed and deployed models to drive the Spectra AI platform's satellite image analytics as well as served as the PI on the IARPA SMART program.",
      "companyUrl": "https://www.blacksky.com/",
    },
    {
      "date": "2019 - 2020",
      "title": "Senior Data Scientist",
      "company": "HouseCanary",
      "description": "Developed and deployed computer vision models for extracting insights and features from real estate property images for improving HouseCanary's Automated Valuation Model (AVM) and property recommender system utilized by real estate investors.",
      "companyUrl": "https://www.housecanary.com/"
    },
    {
      "date": "2018 - 2019",
      "title": "Senior Data Scientist",
      "company": "Booz Allen Hamilton",
      "description": "Researched and developed prototypes for deep learning-based image steganography detection and removal as well as adversarial domain generation detection.",
      "companyUrl": "https://www.boozallen.com/menu/office-locations/san-antonio.html"
    },
    {
      "date": "2016 - 2018",
      "title": "Research Engineer",
      "company": "Southwest Research Institute (SwRI)",
      "description": "Developed and deployed software updates to the A-10 Warthog aircraft as well as researched machine learning methods for detecting engine stalls and exploiting the MIL-STD-1553 communications bus.",
      "companyUrl": "https://www.swri.org/technical-divisions/defense-intelligence-solutions",
      "advisor": "Kenneth Holladay",
    },
    {
      "date": "2015",
      "title": "Research Intern",
      "company": "Oak Ridge National Laboratory (ORNL)",
      "description": "Recorded and annotated a dataset of seismic signals of human and vehicle activity and trained machine learning methods to detect this activity.",
      "companyUrl": "https://www.ornl.gov/group/isf",
      "advisor": "Paul Ewing"
    }
];
