from jinja2 import Environment, FileSystemLoader
import argparse
import json

env = Environment(loader=FileSystemLoader("templates/"))
template = env.get_template("template.txt")
f = open("be.json")
data = json.load(f)
for i in data:
    print(i)
f.close()    

parser = argparse.ArgumentParser(description="Génération du fichier TS")
parser.add_argument('-c', '--component', type=str, help="Le commponent angular")
parser.add_argument('-b', '--be', type=str, help="La Business Entity")
args = parser.parse_args()
names = args.component.split("-")
component_names = []
for n in names:
    component_names.append(n.capitalize())
component_name = "".join(component_names)

content = template.render(be=args.be, component=args.component, component_name=component_name)

with open("resultat.ts", mode="w", encoding="utf-8") as message:
    message.write(content)