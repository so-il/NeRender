/****************************************************************** 
 * @render
 * Description: living dom 模板渲染引擎
 *******************************************************************/
var render = require('./lib/render');
var vtpl = require('./lib/vtpl');

module.exports = render.render;
module.exports.compile = render.compile;
module.exports.vtpl = vtpl;