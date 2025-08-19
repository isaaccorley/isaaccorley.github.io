import { GiscusComments } from '@/components/giscus-comments';
import { ProfileSection } from '@/components/profile-section';
import { giscusConfig } from '@/config/giscus';
import { aboutMe } from '@/data/aboutme';
import { getAllPostSlugs, getPostData } from '@/data/blog';
import { notFound } from 'next/navigation';

export async function generateStaticParams() {
  const posts = getAllPostSlugs();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const post = await getPostData(slug);
    
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

            {/* Right Column - Blog Post Content */}
            <div className="col-span-12 md:col-span-7 md:col-start-6 space-y-24">
              <article>
                <header className="mb-12">
                  <h1 className="font-serif text-3xl font-light tracking-wide mb-4">
                    {post.title}
                  </h1>
                  <p className="text-xs text-zinc-500 mb-4">{post.date}</p>
                  {post.tags && (
                    <div className="flex gap-2 flex-wrap">
                      {post.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs text-zinc-600 px-2 py-1 bg-zinc-100 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </header>
                
                <div 
                  className="prose prose-zinc max-w-none"
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />
              </article>

              {/* Comments Section */}
              <GiscusComments
                repo={giscusConfig.repo}
                repoId={giscusConfig.repoId}
                category={giscusConfig.category}
                categoryId={giscusConfig.categoryId}
                mapping={giscusConfig.mapping}
                strict={giscusConfig.strict}
                reactionsEnabled={giscusConfig.reactionsEnabled}
                emitMetadata={giscusConfig.emitMetadata}
                inputPosition={giscusConfig.inputPosition}
                theme={giscusConfig.theme}
                lang={giscusConfig.lang}
              />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    notFound();
  }
}