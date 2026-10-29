async (page) => {
await page.getByRole('navigation',{name:'管理后台功能'}).waitFor();
for(const name of ['用户管理','智能柜管理','操作日志','网站设置']){await page.getByRole('navigation').getByRole('link',{name,exact:true}).click();await page.getByRole('heading',{level:1,name,exact:true}).waitFor();}
await page.setViewportSize({width:375,height:812});
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
await page.screenshot({path:'output/admin-live.png',fullPage:true});
}
