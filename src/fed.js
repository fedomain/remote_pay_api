const families = [
  {title: 'Fed'},
  {title: 'Sunshine'}
]

const getFamilies = () => {
  let promise = new Promise((resolve, reject) => {
    setTimeout(() => {
      families.forEach((family, index) => {
        console.log(family.title)
      });

      const error = false;

      if (error) {
        reject();
      } else {
        resolve();
      }
    }, 1000);
  });

  return promise;
}

const createFamilies = (family) => {
  let promise = new Promise((resolve, reject) => {
    setTimeout(() => {
      families.push(family);

      const error = false;

      if (error) {
        reject('Error');
      } else {
        resolve('Good');
      }
    }, 5000);
  });

  promise
  .then((value) => {
    console.log(value);
  })
  .catch((err) => {
    console.log(err);
  });

  return promise;
}

const init = async () => {
  console.log('=== Start Waiting ===');
  await createFamilies({title: 'Stella'});
  await getFamilies();
  console.log('=== End Waiting ===');
}

const fedtest = () => {
  let json = '[{"userid": "sadfasdf", "success": true}]';
  let jsonObj = JSON.parse(json);

  console.log(isJson(json));
  console.log();
}

const isJson = (json) => {
  try {
    JSON.parse(json);
    return true;
  } catch(e) {
    return false;
  }
}

const isJsonEmpty = (json) => {
  try {
    let jsonString = JSON.parse(json);
    return true;
  } catch(e) {
    return true;
  }
}

fedtest();
//init();
//createFamilies({title: 'Felicity'});

