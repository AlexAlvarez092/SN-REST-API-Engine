var GlideRecordUtils = Class.create();

GlideRecordUtils.create = function(dataOrGR, tableName) {
	var glideRecord;
	if (dataOrGR instanceof GlideRecord) {
		glideRecord = dataOrGR;
	} else {
		glideRecord = GlideRecordUtils.newRecord(tableName);
		global.SCM_GlideRecordUtils.populate(glideRecord, dataOrGR);
	}

	if (glideRecord.isNewRecord() && glideRecord.insert()) {
		return glideRecord;
	}
};

GlideRecordUtils.finishCreation = function(glideRecord, tableName) {
    if (!gs.nil(glideRecord) && glideRecord.isNewRecord() && (gs.nil(tableName) || glideRecord.getRecordClassName() == tableName)) {
        return glideRecord.insert();
    }
};

GlideRecordUtils.newRecord = function(tableName) {
    var newRecordGR = new GlideRecord(tableName);
    newRecordGR.newRecord();
    return newRecordGR;
};

GlideRecordUtils.populate = function(glideRecord, dataMap) {
    global.SCM_ObjectUtils.forEach(dataMap, function(fieldValue, fieldName) {
        glideRecord[fieldName] = fieldValue;
    });
};

GlideRecordUtils.prototype = {

    initialize: function(record, tableName /*optional*/ ) {
        this.logger = new global.GSLog('', this.type);
        this.logger.includeTimestamp();

        gs.include("j2js");

        // Set TABLE_NAME dynamically if it is empty.
        if (gs.nil(this.TABLE_NAME)) {
            this._setTableNameAuto(record, tableName);
        }

        this.record = this._getRecord(record, tableName);
    },

    encodeToObject: function(args) {
        var obj = {};
		var that = this;
        args.forEach(function(arg) {
            obj[arg] = that.record.getValue(arg);
        });

        return obj;
    },

    getChoiceOptions: function(element) {
        var choices = [];

        var grChoices = new GlideRecord('sys_choice');
        grChoices.addQuery('name', 'IN', this._getTableHierarchy(this.record)); //getRecordClassName
        grChoices.addQuery('element', element);
        grChoices.addQuery('language', 'en');
        grChoices.addQuery('inactive', false);
        grChoices.query();

        while (grChoices.next()) {
            var objChoice = {};
            objChoice.label = grChoices.getValue('label');
            objChoice.value = grChoices.getValue('value');
            objChoice.dependentValue = grChoices.getValue('dependent_value');
            choices.push(objChoice);
        }
        return choices;
    },

    getDisplayRefValue: function(referenceFieldName, targetFieldName) {
        var resultDisplayValue = "";
        var refGr = this.record[referenceFieldName].getRefRecord();
        if (refGr.isValidRecord()) resultDisplayValue = refGr.getDisplayValue(targetFieldName);
        return resultDisplayValue;
    },

    getRecord: function() {
        return this.record;
    },

    isValidChoiceValue: function(element) {
        var elementValue = this.record.getValue(element);
        if (!elementValue) return;

        var choiceOptions = this.getChoiceOptions(element);

        var grDictionaryField = new GlideRecord('sys_dictionary');
        grDictionaryField.addQuery('name', 'IN', this._getTableHierarchy(this.record));
        grDictionaryField.addQuery('element', element);
        grDictionaryField.setLimit(1);
        grDictionaryField.query();

        if (!grDictionaryField.next()) this._throwError('Internal error', 500, 'Table definition not found');

        var dependentField = grDictionaryField.getValue('dependent_on_field');
        var dependentValue = dependentField ? this.record.getValue(dependentField) : undefined;

        var dependentFiltered = dependentValue ?
            choiceOptions.filter(function(choice) {
                return choice.dependentValue === dependentValue;
            }) : choiceOptions;

        var valueFiltered = dependentFiltered.filter(function(choice) {
            return choice.value === elementValue;
        });

        if (valueFiltered.length === 0) {

            var message = dependentField ? 
                'Choice option ' + this.record.getDisplayValue(element) + ' is not a valid value for field ' + this.record.getElement(element).getLabel() + ' when ' + this.record.getElement(dependentField).getLabel() + ' is ' + this.record.getDisplayValue(dependentField) :
                'Choice option ' + this.record.getDisplayValue(element) + ' is not a valid value for field ' + this.record.getElement(element).getLabel();

            return message;
        }
        return '';
    },

    _getRecord: function(record) {
        var grRecord = new GlideRecord(this.TABLE_NAME);

        // sys_id
        if (typeof(record) === 'string' && record.length === 32) {
            !grRecord.get(record) ? this._throwError('Record not found', 400, 'Record not found by sys_id') : undefined;
            return this._returnGlideRecord(grRecord);
        }

        // keys
        else if (typeof(record) === 'string') {
            var keys = gs.getProperty('gliderecordutils.keys', 'number,u_number');
            var keysArr = keys.split(',');

            //keysArr[0]
            var fieldFound = false;
            var qc = undefined;
            keysArr.forEach(function(key) {

                //keysArr[0]
                if (grRecord.isValidField(key) && !fieldFound) {
                    fieldFound = true;
                    qc = grRecord.addQuery(key, record);
                }

                //keysArr[1,n]
                else if (grRecord.isValidField(key) && fieldFound) {
                    qc.addOrCondition(key, record);
                }
            });

            grRecord.query();

            !grRecord.next() ? this._throwError('Record not found', 400, 'Record not found by keys') : undefined;
            return this._returnGlideRecord(grRecord);
        }

        // GlideRecord
        else if (typeof(record) === 'object' && (record.isValidRecord() || record.isNewRecord())) return this._returnGlideRecord(record);

        // Record not found
        this._throwError('Record not found', 400, 'Record not found by any method');
    },

    _getTableHierarchy: function(record) {
        var hierarchy = new TableUtils(record.getRecordClassName()).getHierarchy();
        return j2js(hierarchy);
    },

    _returnGlideRecord: function(record) {
        if (record.getRecordClassName() === this.TABLE_NAME) return record;

        // extended tables
        var hierarchy = this._getTableHierarchy(record);

        if (hierarchy.indexOf(this.TABLE_NAME) >= 0) {
            var grExtended = new GlideRecord(record.getRecordClassName());
            if (grExtended.get(record.getUniqueValue())) return grExtended;
        }

        this._throwError('Record not found', 400, 'Record not found by GlideRecord');
    },

    _setTableNameAuto: function(record, tableName) {
        if (!gs.nil(tableName)) this.TABLE_NAME = tableName;
        
        else if (typeof(record) === 'object' && (record.isValidRecord() || record.isNewRecord())) this.TABLE_NAME = record.getRecordClassName();
        
        else this._throwError('Table name undefined', 400), 'Table name not found';
    },

    _throwError: function(errorMessage, errorCode, errorDetail) {
        var message = errorMessage || 'Unknown error';
        this.logger.logError(message);
        var err = new Error(message);
        err.code = errorCode || '';
        err.detail = errorDetail || '';
        throw err;
    },

    type: 'SCM_GlideRecordUtils'
};