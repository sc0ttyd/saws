'use strict';
var _ = require('lodash');

module.exports = function(Saws) {
    var ddb = new Saws.AWS.DynamoDB();
    var doc = new Saws.AWS.DynamoDB.DocumentClient();

    var Table = function(opts) {
        this.tableName = opts.TableName + '-' + Saws.stage;
        this.opts = opts;
        this.created = false;
    };

    Table.prototype.waitUntilTableActive = function(cb) {
        var self = this;

        ddb.describeTable({TableName: this.tableName}, function(err, data) {
            Saws.DEBUG('ddb.describeTable', err, data);
            self.status = _.get(data, 'Table.TableStatus');
            if (self.status === 'ACTIVE') {
                self.created = true;
                cb();
            }
            else {
                self.waitUntilTableActive(cb);
            }
        });
    };

    Table.prototype.initialize = function(cb) {
        if (!this.created) {
            var self = this;

            ddb.createTable(_.merge(_.cloneDeep(this.opts), {TableName: this.tableName}),
                function(err, data) {

                    if (err) {

                        if (err.name === 'ResourceInUseException') {
                            self.created = true;
                            self.status = 'ACTIVE';
                            cb();
                        } else {
                            Saws.DEBUG('ddb.createTable', err, data);
                            if (err.name === 'ValidationException') {
                                process.exit(1);
                            }
                            cb(err);
                        }
                    } else {
                        self.waitUntilTableActive(cb);
                    }
                }
            );
        }
        else {
            cb();
        }
    };

    Table.prototype.delete = function(params, cb) {
        var self = this;
        var fullParams = {};

        if (params.Key) {
            fullParams = params;
        } else {
            // Simple mode, only passing the keyname: property
            if (Object.getOwnPropertyNames(params).length > 1) {
                return cb('SAWS: Expected a full DocumentClient.delete() spec or simply {<keyname>: value}');
            }

            fullParams.Key = params;
        }

        this.initialize(function() {
            doc.delete(_.merge(_.cloneDeep(fullParams), {TableName: self.tableName}), function(err, data) {
                Saws.DEBUG('ddb.doc.delete', err, data);
                if (cb) {
                    cb(err, data);
                }
            });
        });
    };

    Table.prototype.lookup = function(params, cb) {
        var self = this;

        this.initialize(function() {
            doc.get({
                'TableName': self.tableName,
                'Key': params
            }, function(err, data) {
                Saws.DEBUG('ddb.doc.get', err, data);
                if (data) {
                    data = data.Item;
                }

                if (cb) {
                    cb(err, data);
                }
            });
        });
    };

    Table.prototype.query = function(params, cb) {
        var self = this;

        this.initialize(function() {
            doc.query(_.merge(_.cloneDeep(params), {TableName: self.tableName}), function(err, data) {
                Saws.DEBUG('ddb.doc.query', err, data);
                if (cb) {
                    if (data) {
                        cb(err, data.Items);
                    } else {
                        cb(err);
                    }
                }
            });
        });
    };

    Table.prototype.save = function(params, cb) {
        var self = this;

        this.initialize(function() {
            doc.put({
                'TableName': self.tableName,
                'Item': params
            }, function(err, data) {
                Saws.DEBUG('ddb.doc.put', err, data);
                if (cb) {
                    cb(err, data);
                }
            });
        });
    };

    Table.prototype.scan = function(params, cb) {
        var self = this;

        this.initialize(function() {
            doc.scan(_.merge(_.cloneDeep(params), {TableName: self.tableName}), function(err, data) {
                Saws.DEBUG('ddb.doc.scan', err, data);
                if (data) {
                    data = data.Items;
                }

                if (cb) {
                    cb(err, data);
                }
            });
        });
    };

    Saws.Table = Table;
};
