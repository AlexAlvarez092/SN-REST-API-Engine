var APIUtils = Class.create();
APIUtils.prototype = {
	initialize: function (args) {
		// Initialize logger
		this.logger = new GSLog('', this.type);
		this.logger.includeTimestamp();
		this.logger.setLevel(global.GSLog.DEBUG); 

		// Initialize settings and mapping objects
		this.settings = this._getSettings(args.table);
		this.mapping = this._getMapping();

		// Initialize variables relevant to GET requests or response send for other kind of requests
		this.metadata = args.metadata || undefined; // Internally used. Defines whether return or not the pagination, sort, etc. info in GET requests
		this.paginate = args.paginate || undefined;
		this.sort = args.sort || undefined;
		this.query = args.query || undefined; // Undefined for POST / PUT requests

		// Initialize logging variables
		// this.headers = args.headers || undefined;
		// this.url = args.url || undefined;
		// this.scriptedRestMessage = args.scriptedRestMessage || undefined;

		// Initialize variables relevant to POST / PUT requests
		this.payload = args.payload || undefined; // Undefined for GET requests. Mandatory for POST / PUT requests
		this.recordId = args.recordId || undefined; // Undefined for POST requests. Mandatory for PUT requests

		// Initialize variables relevant to recursive calls
		// ? Is it possible to identify recursively calls?
		this.recursiveCall = args.recursiveCall || false; // In recursive calls, this need to be true

		// Variables used in several places
		this.grRecord = args.record || undefined;
		this.error = undefined;
	},

	getRequest: function () {
		this.grRecord = new GlideRecord(this.settings.table.name);
		!this.paginate && this.grRecord.setLimit(100);

		if (this.query) {
			this._getQuery();
			this.grRecord.addEncodedQuery(this.query);
		}

		this.sort && this._sort();
		this.paginate && this._paginate();

		this.grRecord.query();

		var records = [];

		while (this.grRecord.next())
			records.push(this._decodeGr(this.grRecord));

		var response = !this.metadata ? 
			records[0] :
			{
				pageInfo: {
					totalPages: this.paginate ? Math.ceil(this._getCount() / this.paginate.perPage) : 1,
					currentPage: this.paginate ? parseFloat(this.paginate.page) : 1
				},
				count: records.length,
				data: records
			};
		return response;
	},

	postRequest: function () {
		var response = (this.payload.constructor === Array) ? this._postMultipleRequests() : this._postSingleRequest();
		return response;
	},

	_buildGlideRecord: function (payload) {
		this._canPost(payload); 

		var _gr = new GlideRecord(this.settings.table.name);
		_gr.newRecord();

		for (var _field in payload) _gr = this._encodeGr(_gr, _field, 'post', payload);

		// Validation
		if (this.settings.validate) this._exec('u_rest_api_configuration_table', this.settings.id, 'u_validation_script', _gr);

		return _gr;
	},

	_canPost: function (payload) {
		//forbidden attributes
		this._checkForBiddenAttributes(payload, 'post');
		//required attributes
		this._checkMissingRequiredAttributes(payload);

		for (var field in payload) {
			var map = this._getFieldMap(field);

			//field not recognise
			if (!map) this._throwError('Unknown attribute ' + field + ' included in payload for table: ' + this.settings.table.name, 400, '');

			switch (map.type) {
				case 'reference':
					// Payload contains a new record
					if (typeof(payload[field] !== 'string')) continue;

					var grAux = new GlideRecord(map.referencedTable.name);
					if (!grAux.get(map.referencedId.name, payload[field])) this._throwError('Record not found', 400, 'Record with ID ' + payload[field] + ' not found. Please, check payload attribute: ' + field);
					break;

				case 'choice':
					// ? We may reuse the method included in GlideRecordUtils()
					//this._checkChoiceValue(field);
					break;

				default:
					break;
			}
		}
	},

	_canQuery: function (splittedQuery) {
		var _that = this;

		var forbiddenAttrs = [];

		splittedQuery.forEach(function(_e) {
			var _m = _that._getFieldMap(_e);
			if (!_m.query) forbiddenAttrs.push(_e);
		});

		if (forbiddenAttrs.length > 0) this._throwError('Invalid request', 400, 'The following attributes cannot be queried: ' + forbiddenAttrs.toString());
	},

	// TODO
	// ? We may reuse the method included in GlideRecordUtils()
	_checkChoiceValue: function (field) {
		var _that = this;

		var _map = this._getFieldMap(field);

		var _dependentFiltered = this.payload[_map.dependentField] ?
			_map.choices.filter(function (choice) {
				return choice.dependentValue === _that.payload[_map.dependentField];
			}) :
			_map.choices;

		var valueFiltered = _dependentFiltered.filter(function (choice) {
			return choice.value === _that.payload[field];
		});

		if (valueFiltered.length === 0) this._throwError('Invalid value for attribute: ' + field);

	},

	_checkForBiddenAttributes: function (payload, method) {
		
		var _that = this;
		var forbiddenAttrs = [];
		this.mapping.forEach(function (attr) {
			if (!attr[method] && payload[attr.apiField]) forbiddenAttrs.push(attr.apiField);
		});

		// ! Limitation: if there are forbidden attributes in recursive calls they are not detected in this request but they would be in the next request
		if (forbiddenAttrs.length > 0) this._throwError('Forbidden attributes included in payload for table: ' + this.settings.table.name, 400, 'Attributes: ' + forbiddenAttrs.toString());
	},

	_checkMissingRequiredAttributes: function (payload) {
		var _that = this;
		var requiredAttrs = this._getRequiredAttributes();
		var missingAttrs = [];

		requiredAttrs.forEach(function (attr) {
			if (!payload[attr] || gs.nil(payload[attr])) missingAttrs.push(attr);
		});

		// ! Limitation: if there are forbidden attributes in recursive calls they are not detected in this request but they would be in the next request
		if (missingAttrs.length > 0) this._throwError('Required attributes NOT included in payload for table: ' + this.settings.table.name, 400, 'Attributes: ' + requiredAttrs.toString());
	},

	_decodeGr: function (_gr) {
		var obj = {};

		for (var i = 0; i < this.mapping.length; i++) {
			var _m = this.mapping[i];

			// Record is not marked to be included in the response
			if (!_m.get) continue;

			switch (_m.type) {

				// ! Fails but I guess it is related to my PDI version
				case 'date':
					var _gdt = new GlideDateTime(_gr.getValue(_m.dbField.name));
					obj[_m.apiField] = _gdt.getDate().getByFormat(_m.fornat) || "";
					break;

				case 'boolean':
					obj[_m.apiField] = (_gr.getValue(_m.dbField.name) === '1');
					break;

				case 'script':
					obj[_m.apiField] = this._exec('u_rest_api_configuration_object', _m.id, 'u_script_get', _gr);
					break;

				case 'reference':
					switch(_m.getType) {
						case 'display':
							obj[_m.apiField] = _gr[_m.dbField.name][_m.referencedId.name].getDisplayValue();
							break;

						case 'object':
							obj[_m.apiField] = new APIUtils({ table: _m.referencedTable.name, query: 'sys_id=' + _gr[_m.dbField.name].getValue()}).getRequest();
							break;

						default:
							obj[_m.apiField] = _gr[_m.dbField.name].getValue();
							break;
					}
					break;

				default:
					obj[_m.apiField] = _m.getType === 'display' ?
						_gr.getDisplayValue(_m.dbField.name) || "" :
						_gr.getValue(_m.dbField.name) || "";
					break;
			}
		}

		return obj;
	},

	_decodeQuery: function (splittedQuery) {
		var _that = this;
		splittedQuery.forEach(function(_e) {
			var _m = _that._getFieldMap(_e);
			var _s = _e + '(?==)';
			var _r = new RegExp(_s);
			_that.query = _that.query.replace(_r, _m.dbField.name);
		});
	},

	_encodeGr: function (record, field, operation, payload) {
		if (!payload[field]) return; //ignore empty values

		var _map = this._getFieldMap(field);

		switch (_map.type) {

			case 'reference':
				if (typeof(payload[field]) === 'object') {
					record[_map.dbField.name] = new APIUtils({ table: _map.referencedTable.name, recursiveCall: true, payload: payload[field] }).postRequest();
					break;
				} 

				// ? We may reuse the method included in GlideRecordUtils()
				var grAux = new GlideRecord(_map.referencedTable.name);
				// In the methods _canPost and _canPut we checked that the record exists
				grAux.get(_map.referencedId.name, payload[field]);
				record[_map.dbField.name] = grAux.getUniqueValue();
				break;

			case 'script':
				record[_map.dbField.name] = (operation === 'post') ?
					this._exec('u_rest_api_configuration_object', _map.id, 'u_script_post', record, payload[field]) :
					this._exec('u_rest_api_configuration_object', _map.id, 'u_script_put', record, payload[field]);
				break;

			default:
				record[_map.dbField.name] = payload[field];
				break;
		}

		return record;
	},

	_exec: function (table, mapId, script, record, value) {
		var _mapGr = new GlideRecord(table);
		_mapGr.get(mapId);

		var _ev = new GlideScopedEvaluator();
		_ev.putVariable('scope', this);
		_ev.putVariable('record', record);
		value && _ev.putVariable('value', value);

		var _res = _ev.evaluateScript(_mapGr, script);

		if (this.error) this._throwError(this.error, this.error.code, this.error.detail);

		return _res;
	},

	_getCount: function () {
		var _ga = new GlideAggregate(this.settings.table.name);
		_ga.addAggregate('COUNT');
		this.query && _ga.addEncodedQuery(this.query);
		_ga.query();

		var _count = _ga.next() ? _ga.getAggregate('COUNT') : 0;
		return _count;
	},

	_getFieldMap: function (field) {
		var _map = undefined;
		this.mapping.forEach(function (_attr) {
			if (_attr.apiField == field) _map = _attr;
		});

		return _map;
	},

	_getMapping: function () {
		var _arrConfig = [];

		var _grConfig = new GlideRecord('u_rest_api_configuration_object');
		_grConfig.addQuery('u_active', true);
		_grConfig.addQuery('u_configuration_table', this.settings.id);
		_grConfig.orderBy('u_order');
		_grConfig.query();

		while (_grConfig.next()) {
			var _c = _grConfig;

			// Base attributes common to all configuration objects
			var objConfig = {
				id: _c.getUniqueValue(),
				type: _c.getValue('u_type'),
				dbField: {
					name: _c.getValue('u_field') ? _c.u_field.element.getValue() : '',
					/* Dot-walking may break it out if the attribute is empty */
					id: _c.getValue('u_field'),
					label: _c.getDisplayValue('u_field')
				},
				apiField: _c.getValue('u_api_field_name'),
				get: (_c.getValue('u_get') === '1'),
				getType: _c.getValue('u_get_type'),
				post: (_c.getValue('u_post') === '1'),
				put: (_c.getValue('u_put') === '1'),
				display: (_c.getValue('u_display') === '1'),
				required: (_c.getValue('u_required') === '1'),
				query: (_c.getValue('u_query') === '1')
			};

			// Specific attributes as per type
			if (_c.getValue('u_type') === 'reference') {
				objConfig.referencedTable = {
					name: _c.u_referenced_table_name.name.getValue(),
					id: _c.getValue('u_referenced_table_name'),
					label: _c.getDisplayValue('u_referenced_table_name')
				};
				objConfig.referencedId = {
					name: _c.u_referenced_table_id.element.getValue(),
					id: _c.getValue('u_referenced_table_id'),
					label: _c.getDisplayValue('u_referenced_table_id')
				};
			}

			if (_c.getValue('u_type') === 'choice') {
				objConfig.dependentField = _c.getValue('dependent_on_field');

				objConfig.choices = [];

				var grChoice = new GlideRecord('sys_choice');
				grChoice.addQuery('inactive', false);
				grChoice.addQuery('name', _c.u_choice_set.name.getValue());
				grChoice.addQuery('element', _c.u_choice_set.element.getValue());
				grChoice.addQuery('language', 'en');
				grChoice.query();

				while (grChoice.next()) 
					objConfig.choices.push({
						label: grChoice.getValue('label'),
						value: grChoice.getValue('value'),
						dependentValue: grChoice.getValue('dependent_value')
					});
			}

			if (_c.getValue('u_type') === 'date') objConfig.format = _c.getValue('u_format');
			
			_arrConfig.push(objConfig);
		}

		return _arrConfig;
	},

	_getQuery: function() {
		// ! Limitation: Due to ES5, Lookbehind Assertion is not available
		// ! Limitation: The attribute name must be written in camelCase format containing only alphabetic characters
		var _r = /([a-z]+\w*)(?==)/g;
		var _sq = this.query.match(_r);

		this._canQuery(_sq);
		this._decodeQuery(_sq);
	},

	_getRequiredAttributes: function () {
		var _requiredAttrs = [];

		this.mapping.forEach(function (attr) {
			if (attr.required) _requiredAttrs.push(attr.apiField);
		});
		return _requiredAttrs;
	},

	_getSettings: function (table) {
		var _grTable = new GlideRecord('u_rest_api_configuration_table');
		_grTable.addQuery('u_active', true);
		_grTable.addQuery('u_source', 'CONTAINS', gs.getUserID());
		_grTable.addQuery('u_table.name', table);
		_grTable.setLimit(1);

		_grTable.query();

		if (!_grTable.next()) this._throwError('Fatal error', 400, 'Configuration table not found. Table: ' + table);

		return {
			id: _grTable.getUniqueValue(),
			table: {
				name: _grTable.u_table.name.getValue(),
				id: _grTable.getValue('u_table'),
				label: _grTable.getDisplayValue('u_table')
			},
			key: {
				name: _grTable.u_key.element.getValue(),
				id: _grTable.getValue('u_key'),
				label: _grTable.getDisplayValue('u_key')
			},
			custom_post: (_grTable.getValue('u_custom_post') === '1'),
			validate: (_grTable.getValue('u_validate') === '1')
		};
	},

	_insertGlideRecord: function (_gr) {
		// Custom POST. Just encode the gr and execute the script
		// TODO Sent also the original payload
		if (this.settings.custom_post) _gr = this._exec('u_rest_api_configuration_table', this.settings.id, 'u_custom_post_script', _gr);
		else _gr.insert();

		var _resp = this.recursiveCall ? _gr.getUniqueValue() : this._decodeGr(_gr);
		return _resp;
	},

	_paginate: function () {
		var _start = this.paginate.perPage * this.paginate.page - this.paginate.perPage;
		var _end = this.paginate.perPage * this.paginate.page;
		this.grRecord.chooseWindow(_start, _end);
	},

	_postMultipleRequests: function () {
		var _that = this;

		var _arr = [];

		// Build GlideRecord
		this.payload.forEach(function (payload) {
			_arr.push(_that._buildGlideRecord(payload));
		});

		var _res = [];

		// TODO Instead of throw the errors within the forbidden and required checks, do it here so you can send all the errors found in the payload and not just one

		// Insert GlideRecord
		_arr.forEach(function (_gr) {
			_res.push(_that._insertGlideRecord(_gr));
		});

		return _res;
	},

	_postSingleRequest: function () {
		var _gr = this._buildGlideRecord(this.payload);
		return this._insertGlideRecord(_gr);
	},

	_sort: function () {
		var _m = this._getFieldMap(this.sort.by);
		(!this.sort.order || this.sort.order == 'ASC') ?
			this.grRecord.orderBy(_m.dbField.name):
			this.grRecord.orderByDesc(_m.dbField.name);

	},

	_throwError: function (msg, code, detail) {
		this.logger.logError(msg);
		var _err = new Error(msg);
		_err.code = code;
		_err.detail = detail;
		throw _err;
	},

	type: 'APIUtils'
};