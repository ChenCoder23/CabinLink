async (page) => {
await page.route('**/api/admin?*', route => route.fulfill({json:{stats:{users:128,banned:2,active:36,newUsers:14,cabinets:64,files:320,bytes:1234567890},count:{total:1},users:[{id:'preview-user',username:'演示用户',email:'preview@example.com',role:'user',banned_at:null,ban_reason:null,created_at:'2026-10-12',last_login:null,cabinet_count:3,joined_count:2,bytes:12345678}],cabinets:[{id:'preview-cabinet',name:'项目资料',owner_name:'演示用户',closed_at:null,file_count:12,bytes:12345678}],logs:[]}}));
await page.route('**/api/site-settings',route=>route.fulfill({json:{desktopTitle:'柜联 CabinLink',mobileTitle:'柜联',logoUrl:'',canManage:true}}));
await page.reload(); await page.getByText('所有动态，一目了然。').waitFor();
await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'output/admin-desktop.png',fullPage:true});
for (const name of ['用户管理','智能柜管理','操作日志','网站设置']) {await page.getByRole('navigation').getByRole('link',{name,exact:true}).click();await page.getByRole('heading',{name,exact:true,level:1}).waitFor();}
await page.getByRole('navigation').getByRole('link',{name:'用户管理',exact:true}).click();await page.getByRole('button',{name:'重置密码',exact:true}).click();await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'取消',exact:true}).click();
await page.setViewportSize({width:375,height:812});await page.screenshot({path:'output/admin-mobile.png',fullPage:true});
console.log('UI_CHECK',await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,active:document.querySelector('[aria-current=page]')?.textContent})));
}
