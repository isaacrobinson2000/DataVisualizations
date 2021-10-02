import numpy as np
import pandas as pd
from pathlib import Path
import sys

def main(args):
    this_dir = Path(args[0]).resolve().parent
    
    for p in this_dir.glob("*.csv"):
        new_file = p.parent / (p.stem + ".cleancsv")
        
        data = pd.read_csv(p, header=[0, 1, 2], index_col=0)
        
        data.columns = [f"{c[1]}_{c[2]}" for c in data.columns]
        
        print(new_file)
        
        data.to_csv(new_file, index=False)
        
if(__name__ == "__main__"):
    main(sys.argv)
