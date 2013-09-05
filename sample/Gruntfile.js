module.exports = function(grunt) {

  // jiawzhang TODO: move to plugin later.
  // jiawzhang TODO: Use ../views/**/*.tpl instead of belows to collect template files:
  // See sample codes here: https://github.com/yeoman/grunt-usemin/blob/master/tasks/usemin.js
  var beginmin = {
      assetsPath: 'assets', // the folder which will store all the produced css/js files, you should start with this name for your targetFilePath which defined in your html template.
      htmlTemplateAppendix: '.tpl', // Setting the appendix of your html template file, for example: .jsp/.mako/.tml
      htmlTemplatePath: '../views',  // The folder contains all the html template files to be parsed.
      concatFiles: {},
      cssminFiles: {},
      uglifyFiles: {},
      htmlTemplateFiles: {}, // store all the html template names as the key, and css/js minified files and the targetFilePaths as the values.
      // self defined staticPattern
      staticPattern: /static\/(.*?\.(css|js))/i,
      // case insensitive for html tags.
      cssPattern: /<link\s+href\s*=\s*['"][\s\S]+?\.css[\s\S]+?>/gi,
      jsPattern: /<script\s+src\s*=\s*['"][\s\S]+?\.js[\s\S]+?>/gi,
      beginminPattern_global: /<!--\s*beginmin:\s*(\S+)\s*-->([\s\S]*?)<!--\s*endmin\s*-->/g,
      beginminPattern: /<!--\s*beginmin:\s*(\S+)\s*-->([\s\S]*?)<!--\s*endmin\s*-->/
  };

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    clean: {
        all: [beginmin.assetsPath + '/*'] // 'assets/*'
    },
    concat: {
      options: {
        separator: ';',
        stripBanners: true
      },
      dist: {
        files: beginmin.concatFiles
      }
    },
    uglify: {
      options: {
        // DON'T PUT ANY DYNAMICAL CONTENT IN 'banner' LIKE <%= grunt.template.today("yyyy-mm-dd") %>, OTHERWISE THE 'rev' TASK COULD GENERATE FILENAMES BASED ON DYNAMIC CONTENT EACH TIME YOU RUN IT.
        banner: '/*! <%= pkg.name %> */\n',
        report: 'min'
      },
      dist: {
        files: beginmin.uglifyFiles
      }
    },
    cssmin: {
      options: {
          keepSpecialComments: 0,
          // DON'T PUT ANY DYNAMICAL CONTENT IN 'banner' LIKE <%= grunt.template.today("yyyy-mm-dd") %>, OTHERWISE THE 'rev' TASK COULD GENERATE FILENAMES BASED ON DYNAMIC CONTENT EACH TIME YOU RUN IT.
          banner: '/*! <%= pkg.name %> */\n',
          report: 'min'
      },
      dist: {
        files: beginmin.cssminFiles
      }
    },
    rev: {
        options: {
          encoding: 'utf8',
          algorithm: 'md5',
          length: 8
        },
        files: {
            src: [
              beginmin.assetsPath + '/**/*'
            ] // means 'assets/**/*'
        }
    }
  });


    // Put all the css or js files in one static block to the coressponding files object.
    var _fillUpFilesWithPattern = function (abspath, targetFilePath, pattern, files, staticBlock) {
        if (targetFilePath in files) {
            grunt.warn('In the file: ' + abspath + ', the target filename: ' + targetFilePath + ' has already defined in the other html template file.');
        }
        var results = staticBlock.match(pattern);
        if (results) {
            files[targetFilePath] = [];
            for (var index in results) {
                // results[index] could be like below, use staticPattern to fetch real static filepath further.
                // <link href="${request.static_url('zuoyeproject:static/css/bootstrap.css')}" rel="stylesheet" media="screen">
                // <script src="${request.static_url('zuoyeproject:static/editor/common.js')}">
                var result = results[index].match(beginmin.staticPattern);
                if (!grunt.file.exists(result[1])) {
                    grunt.warn('This file does not exist: "' + result[1] + '"');
                }
                files[targetFilePath].push(result[1]);
            }
        }
    };

  // jiawzhang: collect the css/js filepath from template files and fill up the dist/files in concat/cssmin
  var _handleStaticBlock = function (abspath, targetFilePath, staticBlock) {

    // determine the css or js type.
    var files = null;
    var pattern = null;

    if (targetFilePath.match(/\.css$/i)) {
        pattern = beginmin.cssPattern;
        files = beginmin.cssminFiles;
    } else if (targetFilePath.match(/\.js$/i)) {
        pattern = beginmin.jsPattern;
        files = beginmin.concatFiles;

        // One more step for the js file: The js file will be uglified further.
        beginmin.uglifyFiles[targetFilePath] = targetFilePath;
    }

    // handle css or js
    _fillUpFilesWithPattern(abspath, targetFilePath, pattern, files, staticBlock);
  };

  // Change 'assets/mdeditor.min.js' to 'assets/' and 'mdeditor.min.js'
  // The passed in targetFilePath should have been checked start with 'beginmin.assetsPath' and end with '.css/.js'
  var _splitPathAndFilename = function (targetFilePath) {
    var splitPaths = targetFilePath.split('/');
    var targetFilename = splitPaths.pop();
    var targetPath = splitPaths.join('/');
    targetPath = targetPath + '/';
    return [targetPath, targetFilename];
  };

  var _getTargetFileRefrences = function (abspath, fileContent, targetFilePaths) {
    var fileContentWithoutStaticBlocks = fileContent.replace(beginmin.beginminPattern_global, '');

    // Get all the static files excluding the ones in beginmin comment blocks.
    var cssFiles = fileContentWithoutStaticBlocks.match(beginmin.cssPattern);
    var jsFiles = fileContentWithoutStaticBlocks.match(beginmin.jsPattern);

    // Check the css/js tags contain the targetFilePath or not, if yes, put them to the cssFileRefs/jsFileRefs
    var cssFileRefs = {};
    var jsFileRefs = {};

    for (var fileIndex in targetFilePaths) {

        var targetFilePath = targetFilePaths[fileIndex];

        if (targetFilePath.indexOf(beginmin.assetsPath + '/') !== 0) {
            grunt.warn('In the file: ' + abspath + ', the target filename should start with ' + beginmin.assetsPath + '/' + ' instead of current one: ' + targetFilePath);
        }

        if (!targetFilePath.match(/\S+\.(css|js)$/i)) {
            grunt.warn('In the file: ' + abspath + ', the target filename should end with .css or .js instead of current one: ' + targetFilePath);
        }

        // Change 'assets/mdeditor.min.js' to 'assets/' and 'mdeditor.min.js'
        var pathFilename = _splitPathAndFilename(targetFilePath);
        var targetPath = pathFilename[0];
        var targetFilename = pathFilename[1];

        // determine the css or js type.
        var refPattern = null;
        var staticFiles = null;
        var staticFileRefs = null;

        if (targetFilePath.match(/\.css$/i)) {
            // <link href="${request.static_url('zuoyeproject:static/assets/mdeditor.lib.min.css')}" rel="stylesheet" media="screen">
            // <link href="${request.static_url('zuoyeproject:static/assets/12345678.mdeditor.lib.min.css')}" rel="stylesheet" media="screen">
            // means /<link\s+href\s*=[\s\S]+?assets/(\S+?\.mdeditor.min.js|mdeditor.min.js)[\s\S]+?>/gi
            refPattern = new RegExp('<link\\s+href\\s*=[\\s\\S]+?' + targetPath + '(\\S+?\\.' + targetFilename + '|' + targetFilename + ')[\\s\\S]+?>', 'i');
            staticFiles = cssFiles;
            staticFileRefs = cssFileRefs;
        } else if (targetFilePath.match(/\.js$/i)) {
            // means /<script\s+src\s*=[\s\S]+?assets/(\S+?\.mdeditor.min.js|mdeditor.min.js)[\s\S]+?>/gi
            refPattern = new RegExp('<script\\s+src\\s*=[\\s\\S]+?' + targetPath + '(\\S+?\\.' + targetFilename + '|' + targetFilename + ')[\\s\\S]+?>', 'i');
            staticFiles = jsFiles;
            staticFileRefs = jsFileRefs;
        }

        // Check whether css/js reference tags contain the targetFilePath in the current html template file.
        var matchedResults = null;
        for (var index in staticFiles) {
            matchedResults = staticFiles[index].match(refPattern);
            if (matchedResults) {
                staticFileRefs[targetFilePath] = staticFiles[index];
                break;
            }
        }
        if (matchedResults === null) {
            grunt.warn('In the file: ' + abspath + ', the target filename: ' + targetFilePath + ' is not referred by any css/js tags.');
        }
    }

    return {cssFileRefs: cssFileRefs, jsFileRefs: jsFileRefs, targetFilePaths: targetFilePaths};
  };

  grunt.registerTask('beginmin', 'Collecting css/js files', function() {
    if (!beginmin.htmlTemplateAppendix.match(/^\./)) {
        grunt.warn('htmlTemplateAppendix should begin with "." for example: ".jsp", ".php", ".mako"');
    }
    var htmlTemplateAppendix = new RegExp('\\' + beginmin.htmlTemplateAppendix + '$');
    grunt.file.recurse(beginmin.htmlTemplatePath, function(abspath, rootdir, subdir, filename) {
        if (filename.match(htmlTemplateAppendix)) {
            var fileContent = grunt.file.read(abspath);
            var results = fileContent.match(beginmin.beginminPattern_global);
            if (results) {

                var targetFilePaths = [];
                var staticBlocks = [];
                for (var index in results) {
                    var result = results[index].match(beginmin.beginminPattern);
                    targetFilePaths.push(result[1]); // target file path.
                    staticBlocks.push(result[2]); // static block, maybe css/js
                }

                // get object contains all the targetFilePath in the css/js tags.
                var targetFileRefs = _getTargetFileRefrences(abspath, fileContent, targetFilePaths);
                // Store results for the applymin later.
                beginmin.htmlTemplateFiles[abspath] = targetFileRefs;

                // handle each staticBlock.
                for (var fileIndex in targetFilePaths) {
                    var targetFilePath = targetFilePaths[fileIndex];
                    var staticBlock = staticBlocks[fileIndex];
                    _handleStaticBlock(abspath, targetFilePath, staticBlock);
                }
            }
        }
    });
  });


  // Update the css/js revision in Mako files.
  grunt.registerTask('applymin', 'Update css/js revision in Mako files', function() {

    // Store all the css/js abspaths
    var cssAbspaths = [];
    var jsAbspaths = [];
    grunt.file.recurse(beginmin.assetsPath, function(abspath, rootdir, subdir, filename) {
        if (abspath.match(/\.css$/i)) {
            cssAbspaths.push(abspath);
        } else if (abspath.match(/\.js$/i)) {
            jsAbspaths.push(abspath);
        }
    });

    var htmlTemplateFiles = beginmin.htmlTemplateFiles;
    for (var templateFilename in htmlTemplateFiles) {

        var targetFileRefs = htmlTemplateFiles[templateFilename];

        // Will be used to replace the html template later.
        var changedRevStaticFileRefs = {};
        var isChangedHtmlTemplateFile = false;

        // <link href="${request.static_url('zuoyeproject:static/assets/mdeditor.lib.min.css')}" rel="stylesheet" media="screen">
        for (var fileIndex in targetFileRefs.targetFilePaths) {
            var targetFilePath = targetFileRefs.targetFilePaths[fileIndex];

            // Change 'assets/mdeditor.min.js' to 'assets/' and 'mdeditor.min.js'
            var pathFilename = _splitPathAndFilename(targetFilePath);
            var targetPath = pathFilename[0];
            var targetFilename = pathFilename[1];

            var filenamePattern = new RegExp(targetPath + '\\S+?\\.' + targetFilename);
            var abspaths = null;
            var staticFileRefs = null;
            if (targetFilePath.match(/\.css$/i)) {
                abspaths = cssAbspaths;
                staticFileRefs = targetFileRefs.cssFileRefs;
            } else if (targetFilePath.match(/\.js$/i)) {
                abspaths = jsAbspaths;
                staticFileRefs = targetFileRefs.jsFileRefs;
            }

            // Find the revision file based on targetFilePath defined in html template.
            var revTargetFilePath = null;
            // Check whether css/js reference tags contain the targetFilePath in the current html template file.
            for (var index in abspaths) {
                if (abspaths[index].match(filenamePattern)) {
                    revTargetFilePath = abspaths[index];
                    break;
                }
            }
            if (revTargetFilePath === null) {
                grunt.warn('In the file: ' + templateFilename + ', the target filename: ' + targetFilePath + ' has not been handled to produce a corresponding revision file.');
            }

            // Find referred js/cs tags based on targetFilePath defined in html template.
            var staticFileRef = staticFileRefs[targetFilePath];
            if (staticFileRef === undefined) {
                grunt.warn('In the file: ' + templateFilename + ', the target filename: ' + targetFilePath + ' is not referred by any css/js tags.');
            }
            var revStaticFileRef = staticFileRef.replace(new RegExp(targetPath + '(\\S+?\\.' + targetFilename + '|' + targetFilename + ')', 'i'), revTargetFilePath);
            if (revStaticFileRef != staticFileRef) {
                changedRevStaticFileRefs[staticFileRef] = revStaticFileRef;
                isChangedHtmlTemplateFile = true;
            }
        }
        if (isChangedHtmlTemplateFile) {
            var fileContent = grunt.file.read(templateFilename);
            for (var staticFileRefKey in changedRevStaticFileRefs) {
                while (fileContent.indexOf(staticFileRefKey) != -1) { // replace all for string as the first parameter instead of regexp.
                    grunt.log.writeln('Change: ' + staticFileRefKey);
                    fileContent = fileContent.replace(staticFileRefKey, changedRevStaticFileRefs[staticFileRefKey]);
                    grunt.log.writeln('To: ' + changedRevStaticFileRefs[staticFileRefKey]);
                    grunt.log.writeln();
                }
            }
            grunt.file.write(templateFilename, fileContent);
            grunt.log.write('The file named: ' + templateFilename + ' has been changed...').ok();
        }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-rev');

  // Default task(s).
  grunt.registerTask('default', ['clean:all', 'beginmin', 'concat', 'uglify', 'cssmin', 'rev', 'applymin']);
};
