const STATES = [
 ['aguascalientes','Aguascalientes','AGS'],['baja-california','Baja California','BC'],['baja-california-sur','Baja California Sur','BCS'],
 ['campeche','Campeche','CAM'],['chiapas','Chiapas','CHIS'],['chihuahua','Chihuahua','CHIH'],['ciudad-de-mexico','Ciudad de México','CDMX'],
 ['coahuila','Coahuila','COAH'],['colima','Colima','COL'],['durango','Durango','DGO'],['guanajuato','Guanajuato','GTO'],['guerrero','Guerrero','GRO'],
 ['hidalgo','Hidalgo','HGO'],['jalisco','Jalisco','JAL'],['estado-de-mexico','Estado de México','EDOMEX'],['michoacan','Michoacán','MICH'],
 ['morelos','Morelos','MOR'],['nayarit','Nayarit','NAY'],['nuevo-leon','Nuevo León','NL'],['oaxaca','Oaxaca','OAX'],['puebla','Puebla','PUE'],
 ['queretaro','Querétaro','QRO'],['quintana-roo','Quintana Roo','QROO'],['san-luis-potosi','San Luis Potosí','SLP'],['sinaloa','Sinaloa','SIN'],
 ['sonora','Sonora','SON'],['tabasco','Tabasco','TAB'],['tamaulipas','Tamaulipas','TAMPS'],['tlaxcala','Tlaxcala','TLAX'],
 ['veracruz','Veracruz','VER'],['yucatan','Yucatán','YUC'],['zacatecas','Zacatecas','ZAC']
];

const byCode=new Map(STATES.map(([slug,name,code])=>[code,{slug,name,stateCode:code}]));
function getState(code){return byCode.get(String(code||'').toUpperCase())||null;}
module.exports={STATES,getState};
