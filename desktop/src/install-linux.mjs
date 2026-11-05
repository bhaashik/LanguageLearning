import path from 'node:path';
import os from 'node:os';
import {mkdir,writeFile} from 'node:fs/promises';
export async function installLinux({executable,icon,env=process.env}){
  const data=env.XDG_DATA_HOME||path.join(os.homedir(),'.local','share');
  const applications=path.join(data,'applications'),icons=path.join(data,'icons','hicolor','512x512','apps');
  if(/[\r\n]/.test(executable+data))throw Error('The installation path must not contain a newline.');
  await mkdir(applications,{recursive:true});await mkdir(icons,{recursive:true});
  const iconFile=path.join(icons,'io.github.bhaashik.bhaasa.png');await writeFile(iconFile,icon);
  // Desktop Entry string escaping is applied before Exec argument quoting.
  const command=('"'+executable.replace(/([\\"`$])/g,'\\$1').replace(/%/g,'%%')+'"').replace(/\\/g,'\\\\');
  const entry=path.join(applications,'io.github.bhaashik.bhaasa.desktop');
  await writeFile(entry,`[Desktop Entry]\nType=Application\nName=Bhaasa\nComment=Learn Malayalam and French sounds, grammar and speaking\nExec=${command}\nIcon=${iconFile.replace(/\\/g,'\\\\')}\nTerminal=false\nCategories=Education;Languages;\nStartupNotify=true\n`,{mode:0o644});
  return entry;
}
