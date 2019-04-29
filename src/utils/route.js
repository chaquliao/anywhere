/**
 * @description 用于做文件处理的异步操作 async / await
 */

const chalk = require('chalk');
const path = require('path');
const Handlebars = require('handlebars'); //使用handlebars模板
const fs = require('fs');
const promisify = require('util').promisify; //使用promisify处理异步操作 stat和readdir

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const ct = require('../utils/content-type-util'); //设置content-type
const compress = require('../utils/compress-util'); //压缩
const range = require('../utils/range');
const isFresh = require('../utils/cache-util');

const tplPath = path.join(__dirname, '../template/dir.tpl');
const source = fs.readFileSync(tplPath);
const template = Handlebars.compile(source.toString());

module.exports = async function (req, res, filePath, config) {
  try {
    const stats = await stat(filePath);
    if (stats.isFile()) {
      const contentType = ct(filePath);
      res.setHeader('Content-Type', contentType);

      if(isFresh(stats, req, res)) {
        res.statusCode = 304;
        res.end()
        return
      }

      let rs;
      const {
        code,
        start,
        end
      } = range(stats.size, req, res);
      if (code === 200) {
        res.statusCode = 200;
        rs = fs.createReadStream(filePath);
      } else {
        res.statusCode = 206;
        rs = fs.createReadStream(filePath, {
          start,
          end
        });
      }
      if (filePath.match(config.compress)) {
        rs = compress(rs, req, res);
      }
      rs.pipe(res);
      //fs.createReadStream(filePath).pipe(res);
    } else if (stats.isDirectory()) {
      const files = await readdir(filePath)
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html');
      const dir = path.relative(config.root, filePath)
      const data = {
        title: path.basename(filePath),
        dir: dir ? `/${dir}` : '',
        files
      }
      res.end(template(data));
    }
  } catch (ex) {
    console.error(chalk.red(ex));
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`${filePath} is not a directory\n ${ex}`)
  }
}
