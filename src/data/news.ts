export interface News {
  date: string;
  title: string;
  description: string;
  link?: string;
}

export const newsData: News[] = [
  // If you don't want to show news, just make the array empty.
  {
    date: "November 2025",
    title: "Country-Scale Agricultural Field Boundary Predictions",
    description: "Through my collaboration with Wherobots & Taylor Geospatial Engine, we have open-sourced planting/harvest season mosaics and field boundary predictions for 5 countries for 2023 and 2024.",
    link: "https://source.coop/wherobots/fields-of-the-world",
  },
  {
    date: "October 2025",
    title: "Spatial Stack Podcast: Beyond the Hype: Embeddings, Foundation Models, and the Future of Earth Observation",
    description: "I joined Matt Forrest's Spatial Stack podcast with Chris Ren to discuss the current state of Geospatial Foundation Models and Embeddings.",
    link: "https://www.youtube.com/watch?v=EGj6AGTgjnk",
  },
  {
    date: "August 2025",
    title: "Satellite-Image-Deep-Learning Podcast: Chained Models for High-Res Aerial Solar Fault Detection",
    description: "I joined Robin Cole's Satellite-Image-Deep-Learning podcast to discuss our CPVR PBVS paper: Aerial Infrared Health Monitoring of Solar Photovoltaic Farms at Scale.",
    link: "https://www.youtube.com/watch?v=UcMP0RLfJ7k",
  }
];
