import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const T={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'text/javascript;charset=utf-8','.json':'application/json','.png':'image/png','.webmanifest':'application/manifest+json'};
export function servir(racine, port){
  return new Promise(r => { const s = http.createServer((q,p)=>{
    let u = decodeURIComponent(q.url.split('?')[0]); if(u.endsWith('/')) u += 'index.html';
    const f = path.join(racine, u);
    // Le reseau est coupe dans ce conteneur : toute requete hors du site rend 599,
    // ce qui est EXACTEMENT l'etat qu'on veut photographier, un bureau hors ligne.
    if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ p.writeHead(404); return p.end('nope'); }
    p.writeHead(200,{'Content-Type': T[path.extname(f)]||'application/octet-stream'});
    fs.createReadStream(f).pipe(p);
  }).listen(port, ()=>r(s)); });
}
