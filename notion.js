import fetch from 'node-fetch';
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

export async function pushToNotion({ date, abstract, news }) {
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
    console.log(`📝 开始推送 ${formattedDate} 的全功能版新闻到 Notion...`);

    let childrenBlocks = [];

    // 1. 恢复摘要展示 (Callout 块)
    const cleanAbstract = abstract ? abstract.replace(/<[^>]+>/g, '').trim() : '今日无摘要';
    childrenBlocks.push({
        object: 'block',
        type: 'callout',
        callout: {
            rich_text: [{ type: 'text', text: { content: cleanAbstract.substring(0, 2000) } }],
            icon: { type: 'emoji', emoji: '💡' }
        }
    });

    childrenBlocks.push({ object: 'block', type: 'divider', divider: {} });

    // 2. 遍历新闻，处理序号和分段
    for (let i = 0; i < news.length; i++) {
        const item = news[i];
        
        // 加上序号的标题 (H3)
        childrenBlocks.push({
            object: 'block',
            type: 'heading_3',
            heading_3: {
                rich_text: [{ type: 'text', text: { content: `${i + 1}. ${item.title || '无标题'}` } }]
            }
        });

        // 【关键】分段处理：根据 <p> 标签拆分内容，确保在 Notion 里是多段文字
        if (item.content) {
            const paragraphs = item.content
                .split(/<\/p>|<br\/?>/i) // 根据段落或换行符拆分
                .map(p => p.replace(/<[^>]+>/g, '').trim()) // 删掉所有内部标签
                .filter(p => p.length > 0); // 过滤掉空行

            for (const pText of paragraphs) {
                childrenBlocks.push({
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                        rich_text: [{ type: 'text', text: { content: pText.substring(0, 2000) } }]
                    }
                });
            }
        }
        
        // 每条新闻后面加个分割占位
        childrenBlocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } });
    }

    // 截断防止 504 (Notion API 限制 100 个 block，我们留点余量)
    if (childrenBlocks.length > 95) {
        childrenBlocks = childrenBlocks.slice(0, 95);
    }

    // 随机 Notion 官方封面
    const notionNativeCovers = [
        "https://www.notion.so/images/page-cover/gradients_1.png",
        "https://www.notion.so/images/page-cover/gradients_2.png",
        "https://www.notion.so/images/page-cover/nasa_earth_grid.jpg",
        "https://www.notion.so/images/page-cover/rijksmuseum_mignon_1660.jpg",
        "https://www.notion.so/images/page-cover/woodcuts_1.jpg"
    ];
    const randomCover = notionNativeCovers[Math.floor(Math.random() * notionNativeCovers.length)];

    const body = {
        parent: { database_id: DATABASE_ID },
        cover: { type: 'external', external: { url: randomCover } },
        properties: {
            // 标题列 (Title类型)
            'Title': { title: [{ text: { content: formattedDate } }] },
            // 恢复 Date 列 (Date类型)
            'Date': { date: { start: formattedDate } },
            // 恢复 Abstract 列 (Text类型)
            'Abstract': { rich_text: [{ text: { content: cleanAbstract.substring(0, 2000) } }] }
        },
        children: childrenBlocks
    };

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
            console.log(`✅ 已成功推送！日期：${formattedDate}，含序号与分段排版。`);
        }
    } catch (err) {
        console.error(`❌ 推送异常:`, err.message);
    }
}
