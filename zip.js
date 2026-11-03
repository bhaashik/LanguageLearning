// Small ZIP STORE implementation for Bhaasa's own uncompressed audio backups.
const enc=new TextEncoder(),dec=new TextDecoder();
const table=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
export function packZip(entries) {
  const parts=[],central=[];let offset=0,centralSize=0;
  for(const entry of entries){
    const name=enc.encode(entry.name),data=entry.data,crc=crc32(data);
    const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);
    parts.push(local,data);
    const header=new Uint8Array(46+name.length),c=new DataView(header.buffer);
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);header.set(name,46);central.push(header);centralSize+=header.length;offset+=local.length+data.length;
  }
  const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
export async function unpackZip(blob) {
  if(blob.size>120*1024*1024)throw Error('Backup exceeds the 120 MB import limit.');
  const bytes=new Uint8Array(await blob.arrayBuffer()),v=new DataView(bytes.buffer),files=new Map();let p=0;
  while(p+4<=bytes.length&&v.getUint32(p,true)===0x04034b50){
    if(p+30>bytes.length||files.size>=2000)throw Error('Invalid audio archive.');
    const flags=v.getUint16(p+6,true),method=v.getUint16(p+8,true),crc=v.getUint32(p+14,true),size=v.getUint32(p+18,true),raw=v.getUint32(p+22,true),nl=v.getUint16(p+26,true),el=v.getUint16(p+28,true),start=p+30+nl+el;
    if(method!==0||flags&9||raw!==size||start+size>bytes.length)throw Error('Use an unmodified Bhaasa audio export (ZIP STORE format).');
    const name=dec.decode(bytes.slice(p+30,p+30+nl));
    if(!name||name.startsWith('/')||name.split('/').some(x=>x==='..')||files.has(name))throw Error('Invalid archive path.');
    const data=bytes.slice(start,start+size);if(crc32(data)!==crc)throw Error('Audio backup checksum failed.');
    files.set(name,data);p=start+size;
  }
  if(!files.size||p+4>bytes.length||v.getUint32(p,true)!==0x02014b50)throw Error('Not a Bhaasa ZIP audio backup.');
  return files;
}
