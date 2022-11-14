params = {
    paginate: {
        perPage: 1,
        page: 1
    },
    sort: {
        by: 'id',
        order: 'DESC'
    },
    // payload: {
    //   description: 'Incident created from API',
    //   status: '2',
    //   problem: {
    //   	description: 'Problem created from API',
    //   },
    //   parent: 'INC0009004'
    // },
    // payload: [
    //   {
    // description: 'Incident created from API',
    //     status: '3',
    //     problem: {
    //     	description: 'Problem created from API',
    //     },
    //   	parent: 'INC0009004'
    //   },
    //   {
    //     description: 'Incident created from API - 2',
    //     status: '2',
    //     problem: {
    //       description: 'Problem created from API - 2',
    //     },
    //     parent: 'INC0009004'
    //   }
    // ],
    payload: {
        status: '2',
        problem: 'PRB0040177',
        assignee: 'abel.tuter'
    },
    table: 'incident',
    /* Mandatory */
    query: 'id=INC0010230',
    recordId: 'INC0010230'
};

var s = new APIUtils(params);

//response = s.getRequest();
//response = s.postRequest();
response = s.putRequest();

gs.info(response);