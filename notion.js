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
    console.log(`📝 开始将 ${formattedDate} 的新闻整合推送到 Notion 一个页面中...`);

    // 1. 构建页面内的正文块 (Children Blocks)
    let childrenBlocks = [];

    // 将总摘要以 Callout (标注框) 的形式放在正文最上方
    childrenBlocks.push({
        object: 'block',
        type: 'callout',
        callout: {
            rich_text: [{ type: 'text', text: { content: abstract.substring(0, 2000) } }],
            icon: { type: 'emoji', emoji: '💡' }
        }
    });

    // 插入一条分割线
    childrenBlocks.push({
        object: 'block',
        type: 'divider',
        divider: {}
    });

    // 遍历组装每一条新闻
    for (let i = 0; i < news.length; i++) {
        const item = news[i];
        const link = newsLinks[i] || '';

        // 新闻标题 (Heading 3)
        childrenBlocks.push({
            object: 'block',
            type: 'heading_3',
            heading_3: {
                rich_text: [{ type: 'text', text: { content: item.title || '无标题' } }]
            }
        });

        // 新闻详细内容 (Paragraph)，并处理 2000 字符限制
        if (item.content) {
            const safeContent = item.content.length > 2000 ? item.content.substring(0, 1995) + '...' : item.content;
            childrenBlocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [{ type: 'text', text: { content: safeContent } }]
                }
            });
        }

        // 原文链接
        if (link) {
            childrenBlocks.push({
                object: 'block',
                type: 'paragraph',
                paragraph: {
                    rich_text: [
                        { type: 'text', text: { content: '🔗 查看原文', link: { url: link } } }
                    ]
                }
            });
        }
    }

    // 处理 Notion API 单次 100 个 Block 的限制
    // 每条新闻占用 3 个 Block，30条新闻就是 90 个，通常不会超。如果超了则进行截断。
    if (childrenBlocks.length > 100) {
        childrenBlocks = childrenBlocks.slice(0, 100);
        console.log('⚠️ 新闻条目过多，为符合 Notion API 限制，已截断部分正文内容。');
    }

    // 2. 构建页面属性 (Properties)
    const body = {
        parent: { database_id: DATABASE_ID },
        properties: {
            // 数据库必须包含名称为"标题"、"日期"、"摘要"的属性列
            '标题': { title: [{ text: { content: `《新闻联播》${formattedDate}` } }] },
            '日期': { date: { start: formattedDate } },
            '摘要': { rich_text: [{ text: { content: abstract.substring(0, 2000) } }] }
        },
        children: childrenBlocks
    };

    // 3. 执行单次推送
    try {
        const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ 页面创建失败:`, error);
        } else {
            console.log(`✅ ${formattedDate} 的整合页面已成功推送到 Notion！`);
        }
    } catch (err) {
        console.error(`❌ 推送异常:`, err.message);
    }
}
