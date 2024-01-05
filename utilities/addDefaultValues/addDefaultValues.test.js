import { expect, test } from "vitest";
import { addDefaultValuesToDocument } from "./addDefaultValues";
import testData from "./tests.json";

testData.forEach((testObj, i) => {
  testObj.tests.forEach((eachTest, index) => {
    test(`Running test ${i + 1}-${index + 1}: ${
      eachTest.description
    }`, async () => {
      const result = await addDefaultValuesToDocument(
        testObj.schema,
        eachTest.instance
      );
      expect(result).toEqual(eachTest.expected);
    });
  });
});