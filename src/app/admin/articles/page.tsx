import { ArticlesList } from '@/components/admin/ArticlesList'
import { listArticles } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Articles() {
  const articles = await listArticles({ limit: 300 })
  return (
    <>
      <div className="mb-7">
        <h1 className="font-display text-[34px] leading-tight text-ink">लेख</h1>
        <p className="mt-1 text-[14px] text-muted">महासंवादवरून आयात केलेले आणि येथे लिहिलेले सर्व लेख. एक लेख अनेक पुस्तकांत वापरता येतो.</p>
      </div>
      <ArticlesList initial={articles} />
    </>
  )
}
