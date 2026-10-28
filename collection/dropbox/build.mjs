import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=await readFile(new URL('../Code.gs',import.meta.url),'utf8');
const terms=source.split('\n').filter(line=>/^const TERMS(_VERSION)?_/.test(line)).join('\n');
const start=source.indexOf('function validate_('),end=source.indexOf('\nfunction submitPublic(',start);
if(start<0||end<0||!terms.includes('TERMS_VERSION_'))throw Error('Shared validation source missing');
const backend=await readFile(new URL('./Backend.gs',import.meta.url),'utf8');
export const code=terms+'\n'+source.slice(start,end)+'\n'+backend;
if(process.argv[2]){
 const output=resolve(process.argv[2]);await mkdir(output,{recursive:true});
 await writeFile(resolve(output,'Code.gs'),code);
 for(const [filename,relative] of [['Bridge.html','../Bridge.html'],['appsscript.json','./appsscript.json']])await writeFile(resolve(output,filename),await readFile(new URL(relative,import.meta.url)));
 console.log('Dropbox deployment bundle written (no credentials).');
}
