# Bundled import templates

Trimmed copies of Beanconqueror's official import templates, from
[graphefruit/Beanconqueror](https://github.com/graphefruit/Beanconqueror/tree/master/resources/excel-templates)
(`Roasted_Bean_Import_Template.xlsx`, `Green_Bean_Import_Template.xlsx`, GPL-3.0).

The only change is that the ~22,000 empty formatted rows (and some stray values in them) were removed
with `fillSheet(template, [], { sheet })`. Row 2 is kept, empty, as the style prototype for date and
number columns. Everything else (readme sheet, `Bean_Information` enums, dropdown validations) is untouched.
