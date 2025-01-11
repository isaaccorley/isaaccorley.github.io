export interface Education {
  year: string;
  institution: string;
  degree: string;
  advisor?: string;
  thesis?: string;
  thesisUrl?: string;
}

export const educationData: Education[] = [
  // If you don't want to show education, just make the array empty.
  {
    year: "2020-2024",
    institution: "University of Texas at San Antonio",
    degree: "Ph.D. in Electrical Engineering",
    advisor: "Paul Rad",
    thesis: "Multimodal Learning for Mapping in Remote Sensing",
    thesisUrl: "https://www.proquest.com/openview/2cb732900bef151f9d771bc63a578a60/1?pq-origsite=gscholar&cbl=18750&diss=y",
  },
  {
    year: "2016-2018",
    institution: "University of Texas at San Antonio",
    degree: "M.S. in Electrical Engineering",
    advisor: "Yufei Huang",
    thesis: "Deep Learning for EEG Spatial Interpolation",
    thesisUrl: "https://www.proquest.com/openview/b5c3c059527e389a846d1a3d09e67ea5/1?pq-origsite=gscholar&cbl=18750&diss=y",
  },
  {
    year: "2012—2016",
    institution: "Texas A&M University - Kingsville",
    degree: "B.S. in Electrical EngineeringMinor in Mathematics",
  },
];
