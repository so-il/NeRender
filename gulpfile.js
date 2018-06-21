'use strict';

var pkg = require('./package.json'),
    gulp = require('gulp'),
    jshint = require('gulp-jshint'),
    rename = require('gulp-rename'),
    header = require('gulp-header'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    browserify = require("browserify"),
    source = require('vinyl-source-stream'),
    buffer = require('vinyl-buffer');

var banner = [
        '/*!',
        ' * <%= pkg.name %> v<%= pkg.version %> (<%= pkg.homepage %>)',
        ' * Copyright <%= new Date().getFullYear() %> <%= pkg.author %>',
        ' * Licensed under the <%= pkg.license %> license',
        ' */\n\n',
    ].join('\n'),
    distPath = './dist/';

gulp.task('build', function (callback) {
    browserify({
        entries: "./build.js"
    }).bundle()
        .pipe(source(pkg.name + ".js"))
        .pipe(buffer())
        .pipe(jshint())
        .pipe(header(banner, {
            pkg: pkg
        }))
        .pipe(gulp.dest(distPath))
        .pipe(uglify().on('error', function (e) {
            console.error(e)
        }))
        .pipe(rename(function (path) {
            path.basename += '.min'
        }))
        .pipe(gulp.dest(distPath));
    callback();
});

gulp.task('watch', ['build'], function () {
    gulp.watch('./lib/**/*', ['build']);
});