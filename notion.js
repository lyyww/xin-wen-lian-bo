import fetch from 'node-fetch';
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

export async function pushToNotion({ date, abstract, news, newsLinks }) {
    if (!NOTION_API_KEY || !DATABASE_ID) {
        console.log('⚠️ Notion配置未完成，跳过推送');
        return;
    }

    const headers = {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
    };

    const formattedDate = date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
    console.log(`📝 开始推送${news.length}条新闻到Notion...`);

    for (let i = 0; i < news.length; i++) {
        const item = news[i];
        const link = newsLinks[i] || '';
        const body = {
            parent: { database_id: DATABASE_ID },
            properties: {
                '标题': { title: [{ text: { content: item.title || '无标题' } }] },
                '日期': { date: { start: formattedDate } },
                '摘要': { rich_text: [{ text: { content: abstract.substring(0, 500) } }] },
                '链接': { url: link || null }
            }
        };

        try {
            const response = await fetch('https://api.notion.com/v1/pages', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                const error = await response.text();
                console.error(`❌ 第${i + 1}条新闻推送失败:`, error);
            } else {
                console.log(`✅ 第${i + 1}条新闻推送成功: ${item.title}`);
            }
        } catch (err) {
            console.error(`❌ 第${i + 1}条新闻推送异常:`, err.message);
        }
    }
    console.log('✨ Notion推送完成');
}
