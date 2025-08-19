import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/blog/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;

export interface AboutMe {
  name: string;
  title: string;
  institution: string;
  description: string;
  email: string;
  imageUrl?: string;
  blogUrl?: string;
  cvUrl?: string;
  googleScholarUrl?: string;
  twitterUsername?: string;
  githubUsername?: string;
  linkedinUsername?: string;
  funDescription?: string; // Gets placed in the left sidebar
  secretDescription?: string; // Gets placed in the bottom
  altName?: string;
  institutionUrl?: string;
}

export const aboutMe: AboutMe = {
  name: "Isaac Corley",
  title: "Senior Machine Learning Engineer",
  institution: "Wherobots",
  description: "Hello! I'm Isaac, a Machine Learning Scientist/Engineer at <a href='https://wherobots.com/'>Wherobots</a> with a Ph.D. in Electrical Engineering from the <a href='https://klesse.utsa.edu/electrical-computer/'>University of Texas at San Antonio (UTSA)</a> advised by <a href='https://scholar.google.com/citations?user=uoCn8c8AAAAJ'>Paul Rad</a>. I train and deploy geospatial computer vision and AI on multispectral aerial and satellite imagery.</br></br>I'm passionate about machine learning and computer vision particularly applied to the geospatial and remote sensing imagery domain. I also regularly maintain popular open-source projects like <a href='https://github.com/microsoft/torchgeo/'>TorchGeo</a> and <a href='https://github.com/isaaccorley/torchseg/'>TorchSeg</a>.</br></br>In a past life, I was involved in developing machine learning solutions for the drone, signal processing, cybersecurity, and biomedical sensor fields as well as updating the embedded software for the <a href='https://en.wikipedia.org/wiki/Fairchild_Republic_A-10_Thunderbolt_II'>U.S. Air Force's A-10 Warthog</a>.</br></br>I'm currently available for consultations. If you're interested in collaborating please reach out!",
  email: "isaac.corley@proton.me",
  imageUrl: "https://raw.githubusercontent.com/isaaccorley/isaaccorley.github.io/refs/heads/main/public/images/portrait.jpg",
  googleScholarUrl: "https://scholar.google.com/citations?user=Xw0xO3UAAAAJ&hl",
  githubUsername: "isaaccorley",
  linkedinUsername: "isaaccorley",
  twitterUsername: "isaaccorley_",
  blogUrl: "/blog", // Changed from external URL to local blog page
  cvUrl: "https://github.com/isaaccorley/isaaccorley.github.io/blob/main/public/Isaac_Corley_Resume.pdf",
};
