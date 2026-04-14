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

// === 以下替换 notion.js 尾部的推送逻辑 ===

    // 随机 Notion 官方封面保持不变
    const notionNativeCovers = [
        "https://www.notion.so/images/page-cover/gradients_1.png",
        "https://www.notion.so/images/page-cover/gradients_2.png",
        "https://www.notion.so/images/page-cover/nasa_earth_grid.jpg",
        "https://www.notion.so/images/page-cover/rijksmuseum_mignon_1660.jpg",
        "https://www.notion.so/images/page-cover/woodcuts_1.jpg"
    ];
    const randomCover = notionNativeCovers[Math.floor(Math.random() * notionNativeCovers.length)];

    // 核心改变：设定安全批次大小
    const CHUNK_SIZE = 80; 

    // 1. 创建页面及第一批数据
    const firstBatch = childrenBlocks.slice(0, CHUNK_SIZE);
    const body = {
        parent: { database_id: DATABASE_ID },
        cover: { type: 'external', external: { url: randomCover } },
        properties: {
            'Title': { title: [{ text: { content: formattedDate } }] },
            'Date': { date: { start: formattedDate } },
            'Abstract': { rich_text: [{ text: { content: cleanAbstract.substring(0, 2000) } }] }
        },
        children: firstBatch
    };

    try {
        let response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const error = await response.text();
            console.error(`❌ 页面创建失败:`, error);
            return; // 创建失败则终止
        } 
        
        const pageData = await response.json();
        const pageId = pageData.id;
        console.log(`✅ 页面骨架创建成功，准备追加剩余内容...`);

        // 2. 循环追加剩余的数据 (分批处理长新闻)
        for (let i = CHUNK_SIZE; i < childrenBlocks.length; i += CHUNK_SIZE) {
            const batch = childrenBlocks.slice(i, i + CHUNK_SIZE);
            response = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
                method: 'PATCH',
                headers: headers,
                body: JSON.stringify({ children: batch })
            });

            if (!response.ok) {
                const error = await response.text();
                console.error(`❌ 追加第 ${i} 块内容失败:`, error);
            } else {
                console.log(`✅ 成功追加 ${batch.length} 个段落区块`);
            }
        }
        
        console.log(`🎉 全部新闻推送完成，内容无一遗漏！`);

    } catch (err) {
        console.error(`❌ 推送异常:`, err.message);
    }
}
}
