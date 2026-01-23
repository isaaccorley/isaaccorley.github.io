export interface BlogPost {
  title: string;
  slug: string;
  date: string;
  description: string;
}

export const blogPosts: BlogPost[] = [
  {
    title: "The Technical Debt of Earth Embedding Products",
    slug: "earth-embedding-products",
    date: "2026-01-22",
    description:
      "A deep dive into seven Earth embedding products, why they don't work together, and what we're doing about it.",
  },
];
