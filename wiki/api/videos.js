const publicData=require('../server/public-data.cjs');
module.exports=(req,res)=>publicData(req,res,'videos');
