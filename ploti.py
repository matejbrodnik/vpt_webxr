import matplotlib
import matplotlib.pyplot as plt
import numpy as np

x = np.arange(4)
y1 = [2, 3.2, 2.9, 2.4]
y2 = [2.85, 3.55, 3.8, 3.15]
y3 = [1.9, 2.75, 2.9, 2.7]
y4 = [3, 3.45, 3.75, 3.4]
width = 0.2

plt.bar(x-0.3, y1, width, color='#5FC45F', edgecolor = "black")
plt.bar(x-0.1, y2, width, color='#55B3C9', edgecolor = "black")
plt.bar(x+0.1, y3, width, color='#E47A7A', edgecolor = "black")
plt.bar(x+0.3, y4, width, color='#D07BB2', edgecolor = "black")
txts = ["Jasnost (premikanje)", "Jasnost (mirovanje)", "Odzivnost", "Udobnost"]
# labels = []
# for txt in txts:
#     labels.append(matplotlib.text.Text(txt, size=12))
plt.xticks(x, txts, fontsize=16)
plt.yticks(np.arange(1, 4.5, 0.5), size=16)
plt.xlabel("Kriteriji", size=18)
plt.ylabel("Ocene", size=18)
plt.legend(['Privzeto', 'Usmerjeno', 'Reprojecirano', 'Usmerjeno + reprojecirano'], fontsize=16)
plt.ylim(bottom=1, top=4.3)
plt.show()