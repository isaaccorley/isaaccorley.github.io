import { BlogEntry } from '@/components/blog-entry';
import { ProfileSection } from '@/components/profile-section';
import { aboutMe } from '@/data/aboutme';
import { getSortedPostsData } from '@/data/blog';

export default function BlogPage() {
  const posts = getSortedPostsData();

  return (
    <div className="min-h-screen bg-[#FFFCF8]">
      <div className="max-w-screen-lg mx-auto px-8 py-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          {/* Left Column - Fixed Info */}
          <div className="col-span-12 md:col-span-4 space-y-12 mb-8 md:mb-0">
            <div className="md:sticky top-12 space-y-8">
              <ProfileSection aboutMe={aboutMe} />
            </div>
          </div>

          {/* Right Column - Blog Posts */}
          <div className="col-span-12 md:col-span-7 md:col-start-6 space-y-24">
            <section>
              <h1 className="font-serif text-3xl font-light tracking-wide mb-12">
                Blog
              </h1>
              <div className="space-y-12">
                {posts.map((post) => (
                  <BlogEntry key={post.slug} post={post} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}