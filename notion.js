import fetch from 'node-fetch';
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

export async function pushToNotion({ date, news }) {
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
    console.log(`📝 开始推送 ${formattedDate} 的极简纯净版新闻到 Notion...`);

    let childrenBlocks = [];

    // 组装正文
    for (let i = 0; i < news.length; i++) {
        const item = news[i];
        
        childrenBlocks.push({
            object: 'block',
            type: 'heading_3',
            heading_3: {
                rich_text: [{ type: 'text', text: { content: item.title || '无标题' } }]
            }
        });

        let cleanContent = item.content ? item.content.replace(/<[^>]+>/g, '').trim() : '无详细内容';
        if (cleanContent.length > 2000) {
            cleanContent = cleanContent.substring(0, 1995) + '...';
        }

        childrenBlocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
                rich_text: [{ type: 'text', text: { content: cleanContent } }]
            }
        });
        
        childrenBlocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: { rich_text: [] }
        });
    }

    if (childrenBlocks.length > 90) {
        childrenBlocks = childrenBlocks.slice(0, 90);
    }

    // 提取的 Notion 官方自带图库 URL
    const notionNativeCovers = [
        "https://www.notion.so/images/page-cover/gradients_1.png",
        "https://www.notion.so/images/page-cover/gradients_2.png",
        "https://www.notion.so/images/page-cover/gradients_3.png",
        "https://www.notion.so/images/page-cover/nasa_earth_grid.jpg",
        "https://www.notion.so/images/page-cover/rijksmuseum_mignon_1660.jpg",
        "https://www.notion.so/images/page-cover/woodcuts_1.jpg",
        "https://www.notion.so/images/page-cover/woodcuts_2.jpg"
    ];
    // 随机选择一张
    const randomCover = notionNativeCovers[Math.floor(Math.random() * notionNativeCovers.length)];

    // 构建请求主体
    const body = {
        parent: { database_id: DATABASE_ID },
        cover: {
            type: 'external',
            external: {
                url: randomCover
            }
        },
        properties: {
            // 现在的属性只保留一个主键（Title），其值为日期
            // 注意：请确保你的 Notion 数据库第一列（带 Aa 图标）的列名为 "Title"
            'Title': { 
                title: [{ text: { content: formattedDate } }] 
            }
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
            console.log(`✅ 已成功推送！标题为 ${formattedDate}`);
        }
    } catch (err) {
        console.error(`❌ 推送异常:`, err.message);
    }
}
