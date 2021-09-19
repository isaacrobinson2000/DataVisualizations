import pandas as pd
import sys
from pathlib import Path
import numpy as np

def main(args):
    print("Converting all xlsx files in this directory...")
    
    this_dir = Path(args[0]).parent
    
    datasets = []
    
    for path in [*this_dir.glob("*.xlsx"), *this_dir.glob("*.xls")]:
        # Read in the spreadsheet...
        df = pd.read_excel(str(path), header=[0, 1, 2, 3])
        
        print(f"Converting: {path}")
        
        # Delete a bunch of features we don't use...
        for column in df:
            column = tuple(i.strip() for i in column)
            # Includes dates, locations, keep
            if("Utility Characteristics" in column or "Utility Charateristics" in column):
                print(column)
                continue
            # The only column we want, resedential consumption...
            if(all((item in column) for item in ["All Technologies", "Customers"])):
                df.loc[df[column] == ".", column] = 0 # Clear out empty entries...
                print(column)
                continue
            
            del df[column]
        
        # Append to datasets...
        datasets.append(df)
        
    print("Merging Datasets")
    
    for data in datasets:
        data.columns = [a[-1].strip() for a in data]
        print(data)

        
    all_data = datasets[0]
    
    for data in datasets[1:]:
        all_data = all_data.append(data, ignore_index=True)
    
    print("Saving...")
    all_data.to_csv(str(this_dir / "residential_consumption.csv"), index=False)
    print("Done!")
        
    
if(__name__ == "__main__"):
    main(sys.argv)
