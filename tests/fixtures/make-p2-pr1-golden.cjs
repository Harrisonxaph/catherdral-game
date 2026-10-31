// Regenerates p2-pr1-generation-golden.json from a COMMITTED baseline (default: main before Phase 2 PR1).
// node tests/fixtures/make-p2-pr1-golden.cjs [ref]
// Only regenerate to move the baseline deliberately; never to make a drifting change pass.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {loadGame,signature,worldDigest}=require('../generation-harness.cjs');
const ref=process.argv[2]||'ef177df';
const commit=execFileSync('git',['rev-parse',ref+'^{commit}'],{encoding:'utf8'}).trim();
const g=loadGame(file=>execFileSync('git',['show',commit+':'+file],{encoding:'utf8',maxBuffer:1<<26}));
const SEEDS=100,DIGEST_SEED=1602022801; // graphics captures pin this seed (tests/visual-capture.cjs)
const floors={};
for(let floor=1;floor<=5;floor++){
  const sigs=[];for(let seed=1;seed<=SEEDS;seed++)sigs.push(signature(g.build(floor,seed)));
  g.build(floor,DIGEST_SEED);
  floors[floor]={signatures:sigs,graphicsSeed:{signature:signature(g),worldDigest:worldDigest(g.world),enemies:g.enemies.length,chests:g.chests.length}};
}
const out={baseline:commit,seeds:SEEDS,graphicsSeed:DIGEST_SEED,floors};
fs.writeFileSync(path.join(__dirname,'p2-pr1-generation-golden.json'),JSON.stringify(out,null,1)+'\n');
console.log('p2-pr1-generation-golden.json written from '+commit);
