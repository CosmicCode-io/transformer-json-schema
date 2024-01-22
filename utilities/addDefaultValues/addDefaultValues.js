import {
  registerSchema,
  unregisterSchema,
  validate,
} from "@hyperjump/json-schema/draft-2020-12";
import { dataType } from "../helpers.js";

export const addDefaults = async (schema, document) => {
  let parsedSchema;
  const result = await parseAndValidateSchema(schema, document);

  if (result === "Invalid Json Schema") {
    return "Invalid Json Schema";
  } else if (!result.isValid) {
    return "Invalid Instance";
  } else {
    parsedSchema = result.schema;
  }

  let updatedDocument;
  try {
    updatedDocument = addDefaultsToObject(parsedSchema, document);
  } catch (error) {
    console.error("Error adding default values", { cause: error });
    return "Error adding default values";
  }
  return updatedDocument;
};

const parseAndValidateSchema = async (schema, document) => {
  try {
    registerSchema(schema);
    const result = await validate(schema.$id, document);

    const isValid = result.valid;
    unregisterSchema(schema.$id);

    return { schema, isValid };
  } catch (error) {
    console.error("Error validating the Schema", { cause: error });
    return "Invalid Json Schema";
  }
};

const addDefaultsToObject = (schema, obj) => {
  if (
    schema.type === "object" ||
    schema.properties ||
    schema.additionalProperties
  ) {
    if (schema.properties) {
      addDefaultsToProperties(schema, schema.properties, obj);
    }
    if (schema.additionalProperties) {
      addDefaultsToAdditionalProperties(schema.additionalProperties, obj);
    }
  } else if (schema.type === "array" || schema.prefixItems || schema.items) {
    return addDefaultsToArray(schema, obj);
  } else if (schema.anyOf) {
    return addDefaults_anyOf(schema, obj);
  } else {
    return schema.default;
  }
  return obj;
};

const addDefaultsToProperties = (schema, properties, obj) => {
  for (const propertyName in properties) {
    const propertyValue = properties[propertyName];
    if (obj[propertyName] === undefined || obj[propertyName] === null) {
      if (propertyValue.default) {
        obj[propertyName] = propertyValue.default;
      } else if (propertyValue.$ref) {
        obj[propertyName] = addDefaultsToObject(
          resolveRef(propertyValue.$ref, schema),
          obj
        );
      } else if (propertyValue.type === "object") {
        obj[propertyName] = {};
        addDefaultsToObject(propertyValue, obj[propertyName]);
      } else if (propertyValue.type === "array") {
        if (propertyValue.default) {
          obj[propertyName] = propertyValue.default;
        } else {
          obj[propertyName] = [];
          if (Array.isArray(propertyValue.prefixItems)) {
            addDefaultsToArray(propertyValue, obj[propertyName]);
          }
        }
      }
    }
  }
  return obj;
};

const addDefaultsToAdditionalProperties = (additionalProps, obj) => {
  for (const property in obj) {
    addDefaultsToObject(additionalProps, obj[property]);
  }
};

const addDefaultsToArray = (schema, arr) => {
  let resultantArr = arr;
  if (schema.prefixItems) {
    resultantArr = addDefaultsToPrefixItems(schema.prefixItems, arr);
  }

  if (schema.items) {
    const prefixArrLength = schema.prefixItems ? schema.prefixItems.length : 0;
    for (let i = prefixArrLength; i < arr.length; i++) {
      addDefaultsToObject(schema.items, arr[i]);
    }
  }

  if (schema.contains) {
    addDefaultsToContains(schema.contains, arr);
  }

  return resultantArr;
};

const addDefaults_anyOf = (schema, obj) => {
  const objCopy = JSON.parse(JSON.stringify(obj));
  for (let i = 0; i < schema.anyOf.length; i++) {
    const result = addDefaultsToObject(schema.anyOf[i], obj);
    if (result !== objCopy) {
      return result;
    }
  }
};

const addDefaultsToContains = (schema, instanceArr) => {
  const datatype = dataType(schema);
  for (let i = 0; i < instanceArr.length - 1; i++) {
    // eslint-disable-next-line no-constant-condition
    if (typeof (instanceArr[i] === datatype)) {
      const allElementsPresent = schema.required.every((element) =>
        // eslint-disable-next-line no-prototype-builtins
        instanceArr[i].hasOwnProperty(element)
      );
      if (allElementsPresent) {
        addDefaultsToObject(schema, instanceArr[i]);
      }
    }
  }
};

const addDefaultsToPrefixItems = (prefixItemsArr, instanceArr) => {
  for (let i = 0; i < prefixItemsArr.length; i++) {
    if (instanceArr[i] === undefined || instanceArr[i] === null) {
      if (prefixItemsArr[i].default) {
        instanceArr[i] = prefixItemsArr[i].default;
      } else return instanceArr;
    } else if (
      prefixItemsArr[i].type === "object" ||
      prefixItemsArr[i].properties
    ) {
      instanceArr[i] = {};
      addDefaultsToObject(prefixItemsArr[i], instanceArr[i]);
    } else if (
      prefixItemsArr[i].type === "array" ||
      prefixItemsArr[i].prefixItems ||
      prefixItemsArr[i].items
    ) {
      addDefaultsToArray(prefixItemsArr[i], instanceArr[i]);
    } else {
      addDefaultsToObject(prefixItemsArr[i], instanceArr);
    }
  }
  return instanceArr;
};

const resolveRef = (ref, schema) => {
  const parts = ref.split("/");
  let node = schema;

  for (let i = 1; i < parts.length; i++) {
    node = node[parts[i]];
  }

  return node;
};

// FOR TESTING PURPOSE -This section will be removed later.
// const schema = {
//   $id: "https://example.com/4",
//   $schema: "https://json-schema.org/draft/2020-12/schema",
//   anyOf: [{ default: 42 }, { default: "foo" }],
// };

// const document = null;
// const result = await addDefaults(schema, document);
// console.log(result);
