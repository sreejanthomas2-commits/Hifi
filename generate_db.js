
const cats = {
  entertainment: ['gaming', 'music', 'wildlife', 'movies', 'documentaries', 'fashion', 'sports', 'cars', 'anime', 'travel', 'food', 'art', 'culture', 'military', 'nature', 'memes', 'podcasts', 'social trends', 'daily world events'],
  growth: ['science', 'crypto', 'finance', 'politics', 'technology', 'space', 'education', 'ai', 'startups', 'history', 'health', 'business', 'environment', 'philosophy', 'psychology', 'coding', 'news', 'research', 'productivity']
};

let output = '  posts: {\n';
for (const feed in cats) {
  output += '    ' + feed + ': [\n';
  cats[feed].forEach((cat, idx) => {
    const cCat = cat.charAt(0).toUpperCase() + cat.slice(1);
    const id1 = feed.charAt(0) + idx + 'a';
    const id2 = feed.charAt(0) + idx + 'b';
    
    // Post 1: video / research
    const type1 = feed === 'growth' ? 'research_paper' : 'video';
    output += \      { id:'\', type:'\', av:'\', creator:'\ Expert', handle:'@\_daily', time:'10m ago', category:'\', title:'The Future of \: An In-Depth Analysis', body:'Exploring the latest trends and breakthroughs in \. What does the next decade look like for this space? Dive into our comprehensive breakdown.', likes:\, shares:\, tips:\, edu:{label:'\ 101',xp:100} },\n\;
    
    // Post 2: social_thread / market_chart / livestream
    let type2 = 'social_thread';
    if(Math.random() > 0.5) {
      type2 = feed === 'growth' ? 'market_chart' : 'livestream';
    }
    output += \      { id:'\', type:'\', av:'LV', creator:'\ Network', handle:'@\_network', time:'LIVE', category:'\', title:'Live Q&A: \ developments', body:'Join the discussion. Over 10k viewers tuning in to see what happens next.', likes:\, shares:\, tips:\, edu:{label:'Community Pulse',xp:75} },\n\;
  });
  output += '    ],\n';
}
output += '  },\n';

const fs = require('fs');
fs.writeFileSync('db_snippet.txt', output);

