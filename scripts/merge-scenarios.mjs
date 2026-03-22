import fs from 'fs';

const src = 'C:/Users/keepe/Desktop/b-side/src/data/scenariosExpanded.ts';

let content = fs.readFileSync(src, 'utf-8');
content = content.trimEnd();
if (content.endsWith('];')) {
    content = content.slice(0, -2);
}
content = content.trimEnd();
if (content.charAt(content.length - 1) !== ',') {
    content += ',';
}

const batchFiles = [
    'C:/Users/keepe/Desktop/角色训练备用文件/scenarios_gambler_psychology.ts',
    'C:/Users/keepe/Desktop/角色训练备用文件/debt-scenarios-20.ts',
    'C:/Users/keepe/Desktop/角色训练备用文件/scenarios_scam_online_30.ts',
    'C:/Users/keepe/Desktop/角色训练备用文件/scenarios-batch-20.ts',
];

for (const fpath of batchFiles) {
    let batch = fs.readFileSync(fpath, 'utf-8').trim();
    if (batch.charAt(batch.length - 1) !== ',') {
        batch += ',';
    }
    content += '\n\n' + batch;
}

content = content.trimEnd();
if (content.charAt(content.length - 1) === ',') {
    content = content.slice(0, -1);
}
content += '\n];\n';

fs.writeFileSync(src, content, 'utf-8');
const lineCount = content.split('\n').length;
const scenarioCount = (content.match(/id: '/g) || []).length;
console.log('Done! Lines:', lineCount, 'Scenarios:', scenarioCount);
