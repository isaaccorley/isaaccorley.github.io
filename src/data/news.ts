export interface News {
  date: string;
  title: string;
  description: string;
  link?: string;
}

export const newsData: News[] = [
  // If you don't want to show news, just make the array empty.
  {
    date: "October 2025",
    title: "Spatial Stack Podcast: Beyond the Hype: Embeddings, Foundation Models, and the Future of Earth Observation",
    description: "I was on Matt Forrest's Spatial Stack Podcast with <a href='https://christopherren.substack.com/'>Chris Ren</a> to discuss the current state of Geospatial Foundation Models and Embeddings.",
    link: "https://www.youtube.com/watch?v=EGj6AGTgjnk",
  },
  {
    date: "October 2025",
    title: "TorchGeo Meetup: Building GeoAI with PyTorch",
    description: "I gave a talk at the PyTorch Conference in San Francisco to give an overview of the TorchGeo library and meet with the community.",
    link: "https://luma.com/user/wherobots?e=evt-u6AxtTVBs6xGlCf",
  },
  {
    date: "August 2025",
    title: "Satellite-Image-Deep-Learning Podcast: Chained Models for High-Res Aerial Solar Fault Detection",
    description: "I was on Robin Cole's Satellite-Image-Deep-Learning podcast to discuss our CPVR PBVS paper: 'Aerial Infrared Health Monitoring of Solar Photovoltaic Farms at Scale'.",
    link: "https://www.youtube.com/watch?v=UcMP0RLfJ7k",
  }
];
