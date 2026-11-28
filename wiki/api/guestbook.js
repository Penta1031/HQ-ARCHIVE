const community=require('../server/community.cjs');
module.exports=(req,res)=>community(req,res,'guestbook');
