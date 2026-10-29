function e(e,t=2*1024*1024){if(e===``)return!0;if(typeof e!=`string`||e.length>Math.ceil(t/3)*4+40)return!1;let n=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(e);if(!n)return!1;try{let e=atob(n[2]);return e.length>t?!1:n[1]===`png`?e.startsWith(`PNG\r

`):n[1]===`jpeg`?e.startsWith(`ÿØÿ`):e.startsWith(`RIFF`)&&e.slice(8,12)===`WEBP`}catch{return!1}}export{e as t};