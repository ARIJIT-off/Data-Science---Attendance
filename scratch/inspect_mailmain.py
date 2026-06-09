import pandas as pd
import os

filePath = "mailmain.xlsx"
if os.path.exists(filePath):
    xl = pd.ExcelFile(filePath)
    print("Sheets:", xl.sheet_names)
    for name in xl.sheet_names:
        print(f"\n--- Sheet: {name} ---")
        df = xl.parse(name, header=None)
        print(df)
else:
    print(f"{filePath} not found")
