async (page) => {
const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&message.text().includes('prefetch'))errors.push(message.text());});
await page.goto('http://43.143.130.165/admin');await page.getByRole('navigation',{name:'管理后台功能'}).waitFor();
for(const name of ['用户管理','智能柜管理','操作日志','网站设置']){await page.getByRole('navigation').getByRole('link',{name,exact:true}).click();await page.getByRole('heading',{level:1,name,exact:true}).waitFor();}
await page.setViewportSize({width:375,height:812});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
if(errors.length)throw Error(errors.join(';'));
await page.getByRole('link',{name:'返回网站',exact:true}).click();await page.waitForURL('http://43.143.130.165/');
}
