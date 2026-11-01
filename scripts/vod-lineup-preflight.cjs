// Local JSON in, review manifest out. Does not read credentials or write a database.
const fs=require('node:fs');
const {prepareNight}=require('../lib/vod-lineup-preflight.cjs');
try{
 const [file,league,season]=process.argv.slice(2);
 if(!file||!league||!season)throw new Error('Usage: node scripts/vod-lineup-preflight.cjs <parser.json> <league> <season>');
 console.log(JSON.stringify(prepareNight(JSON.parse(fs.readFileSync(file,'utf8')),{league,season:Number(season)}),null,2));
}catch(error){console.error(error.message);process.exitCode=1;}
