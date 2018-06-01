import Mixin from '@ember/object/mixin';
import { assert } from '@ember/debug';
import { resolve } from 'rsvp';
import { isArray } from '@ember/array';
import { get } from '@ember/object';
import { camelize } from '@ember/string';

/**
  _This mixin relies on JSON:API, and assumes that your server supports JSON:API includes._

  This mixin adds new data-loading methods to your Ember Data models.

  To use it, extend a model and mix it in:

  ```js
  // app/models/post.js
  import DS from 'ember-data';
  import LoadableModel from 'ember-data-storefront/mixins/loadable-model';

  export default DS.Store.extend(LoadableModel);
  ```

  Once you understand how `LoadableModel` works We suggest adding it to every model in your app. You can do this by reopening `DS.Model` in `app.js.` and mixing it in:

  ```js
  // app/app.js
  import DS from 'ember-data';
  import LoadableModel from 'ember-data-storefront/mixins/loadable-model';

  DS.Model.reopen(LoadableModel);
  ```

  @class LoadableModel
  @public
*/
export default Mixin.create({

  init() {
    this._super(...arguments);
    this.set('_loadedReferences', {});
  },

   /**
    `sideload` gives you an explicit way to asynchronously sideload related data.

    ```js
    post.sideload('comments');
    ```

    The above uses Storefront's `loadRecord` method to query your backend for the post along with its comments.

    You can also use JSON:API's dot notation to load additional related relationships.

    ```js
    post.sideload('comments.author');
    ```

    Every call to `sideload()` will return a promise.

    ```js
    post.sideload('comments').then(() => console.log('loaded comments!'));
    ```

    If a relationship has never been loaded, the promise will block until the data is loaded. However, if a relationship has already been loaded (even from calls to `loadRecord` elsewhere in your application), the promise will resolve synchronously with the data from Storefront's cache. This means you don't have to worry about overcalling `sideload()`.

    This feature works best when used on relationships that are defined with `{ async: false }` because it allows `load()` to load the data, and `get()` to access the data that has already been loaded.

    @method sideload
    @param {String} includesString a JSON:API includes string representing the relationships to check
    @return {Promise} a promise resolving with the record
    @public
  */
  sideload(...includes) {
    let modelName = this.constructor.modelName;

    return this.get('store').loadRecord(modelName, this.get('id'), {
      include: includes.join(',')
    });
  },

  /**
    `load` gives you an explicit way to asynchronously load related data.

    ```js
    post.load('comments');
    ```

    The above uses Ember data's references API to load a post's comments from your backend.

    Every call to `load()` will return a promise.

    ```js
    post.load('comments').then((comments) => console.log('loaded comments as', comments));
    ```

    If a relationship has never been loaded, the promise will block until the data is loaded. However, if a relationship has already been loaded, the promise will resolve synchronously with the data from the cache. This means you don't have to worry about overcalling `load()`.

    @method load
    @param {String} name the name of the relationship to load
    @return {Promise} a promise resolving with the related data
    @public
  */
  load(name, options = {}) {
    assert(
      `The #load method only works with a single relationship, if you need to load multiple relationships in one request please use the #sideload method [ember-data-storefront]`,
      !isArray(name) && !name.includes(',') && !name.includes('.')
    );

    let reference = this._getReference(name);
    let value = reference.value();
    let shouldFetch = !value || options.reload;
    let promise = shouldFetch ? reference.reload() : resolve(value);

    return promise.then(data => {
      // need to track that we loaded this relationship, since relying on the reference's
      // value existing is not enough
      this._loadedReferences[name] = true;
      return data;
    });
  },

  _getReference(name) {
    let relationshipInfo = get(this.constructor, `relationshipsByName`).get(name);

    assert(
      `You tried to load the relationship ${name} for a ${this.constructor.modelName}, but that relationship does not exist [ember-data-storefront]`,
      relationshipInfo
    )

    let referenceMethod = relationshipInfo.kind;
    return this[referenceMethod](name);
  },

  _hasLoadedReference(name) {
    return this._loadedReferences[name];
  },

  /**
    This method returns true if the provided includes string has been loaded and false if not.

    @method hasLoaded
    @param {String} includesString a JSON:API includes string representing the relationships to check
    @return {Boolean} true if the includes has been loaded, false if not
    @public
  */
  hasLoaded(includesString) {
    let modelName = this.constructor.modelName;
    let hasSideloaded = this.get('store').hasLoadedIncludesForRecord(modelName, this.get('id'), includesString);
    let hasLoaded = this._hasLoadedReference(camelize(includesString));

    return hasLoaded || hasSideloaded;
  }

});
