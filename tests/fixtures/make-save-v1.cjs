// Regenerates save-v1-full.json: a deterministic schema-1 character exercising every owner type and all twelve items.
// node tests/fixtures/make-save-v1.cjs  (inspect the diff; the fixture pins the schema-1 byte form)
const fs=require('fs'),path=require('path'),C=require('../../character-state.js');
const keys=['duskdagger','bulwark','ashbringer','oathguard','graveaxe','rustbound','kingsmercy','executioner','mournblade','cryptshield','bloodforged','twinmoon'];
const mods={duskdagger:[{stat:'damage',value:3},{stat:'crit',value:.04}],graveaxe:[{stat:'damage',value:2}],rustbound:[{stat:'speed',value:.04}],executioner:[{stat:'speed',value:.06}],bloodforged:[{stat:'crit',value:.05}]};
const items=keys.map((key,i)=>({id:i+1,key,mods:mods[key]||[],upgradeRank:0})),id=key=>items.find(i=>i.key===key).id;
const stash=Array(C.limits.stash).fill(null);['kingsmercy','executioner','mournblade','cryptshield'].forEach((k,i)=>stash[i]=id(k));
const boss='campaign:forgotten-crypt:boss:snakeling:item';
const payload={
 character:{level:4,lifetimeXp:48+76+110+7,xpIntoLevel:7,unspentSkillPoints:0,coreProfile:'penitent-v1',passiveRanks:{vigor:2,edge:1},abilityUpgradeRanks:{},
  resources:{hp:96.5,equipmentShield:18,potions:2},timers:{abilityCooldowns:{execution:3.5,aegis:0,stunning:11.25},attackRemaining:.1,dodgeRemaining:0,firePassiveRemaining:0,shieldDelay:1.5},
  ash:340,deaths:2,equipment:{main:id('duskdagger'),off:id('bulwark')},backpack:[id('ashbringer'),id('oathguard'),id('graveaxe'),null,id('rustbound'),null],stash,nextItemId:13,abilityUnlocks:['execution','aegis','stunning']},
 items,
 campaign:{unlockedLocations:['forgotten-crypt','plague-halls'],activeCheckpointId:'plague-halls:entrance',campaignComplete:false,bossCompletions:{'forgotten-crypt':true},eliteCompletions:{},
  questStates:{'chapter-1:crown':'complete'},storyFlags:['chapter-1:keeper-met'],journalEntries:[{id:'memory:0',title:'Death memory 1',text:'A remembered death.'}],
  rewardLedger:{[boss]:'escrow','campaign:forgotten-crypt:chest:3:item':'claimed'},rewardEscrow:[{rewardKey:boss,itemId:id('bloodforged')}]},
 world:{lifecycle:{mode:'alive',deathId:null,lastRespawnId:'respawn-2'},currentLocationId:'forgotten-crypt',currentInstanceId:'campaign-forgotten-crypt-1',pendingTransition:null,checkpoints:{},locations:{},
  instances:{'campaign-forgotten-crypt-1':{locationId:'forgotten-crypt',mode:'campaign',groundDrops:[
   {dropId:'drop-1',kind:'item',itemId:id('twinmoon'),amount:1,x:4.5,y:-2.25,rewardKey:null},
   {dropId:'drop-2',kind:'ash',itemId:null,amount:12,x:5,y:-2,rewardKey:null},
   {dropId:'drop-3',kind:'potion',itemId:null,amount:1,x:6,y:1,rewardKey:null}]}}},
 legacy:{migrationId:'legacy-import-1',bestKills:42,narrativeMemories:['A remembered death.'],sourceFingerprint:''}
};
const env=C.envelope(payload,{characterId:'0f1e2d3c-aaaa-4bbb-8ccc-123456789abc',revision:3,createdAt:'2026-10-28T12:00:00.000Z',savedAt:'2026-10-28T12:30:00.000Z',sessionId:'session-a',leaseEpoch:2});
const result=C.validate(env);if(!result.ok)throw Error(JSON.stringify(result.errors));
fs.writeFileSync(path.join(__dirname,'save-v1-full.json'),JSON.stringify(env,null,1)+'\n');
console.log('save-v1-full.json written: '+items.length+' items');
