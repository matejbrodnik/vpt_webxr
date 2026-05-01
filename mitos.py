import nibabel as nib
import numpy as np

outFile = "../../../Downloads/f32_400x401x800_uint8.raw"
# outFile = "../../../Downloads/mitos/fusion330430_256x256x256_.raw"
# nii = nib.load("../../../Downloads/fib1-0-0-0.nii/contact-3-2-1.nii.gz")
# nii = nib.load("../../../Downloads/fibersraw_400x401x800_uint8.raw")
# nii = nib.load("../../../Downloads/mitos/instance-3-2-1.nii.gz")
nii2 = nib.load("../../../Downloads/mitos/instance-3-3-0.nii.gz")
nii3 = nib.load("../../../Downloads/mitos/instance-0-0-0.nii.gz")
nii4 = nib.load("../../../Downloads/mitos/instance-1-0-3.nii.gz")
nii5 = nib.load("../../../Downloads/mitos/instance-4-3-0.nii.gz")

# print(nii.get_data_dtype())

# data = np.fromfile("../../../Downloads/fibersraw_400x401x800_uint8.raw", dtype=np.uint8)
data = np.fromfile("../../../Downloads/fibersid_400x401x800_uint32.raw", dtype=np.uint32)
data = data.reshape((400, 401, 800));
# data = nii.get_fdata(dtype=np.float32)
data2 = nii5.get_fdata(dtype=np.float32)

print(data.min(), data.max())
print(len(np.unique(data)))


#data[data == 2] = 1.5

# data[data % 10 == 0] = 70
# data[data % 10 == 1] = 88
# data[data % 10 == 2] = 106
# data[data % 10 == 3] = 124
# data[data % 10 == 4] = 142
# data[data % 10 == 5] = 160
# data[data % 10 == 6] = 178
# data[data % 10 == 7] = 196
# data[data % 10 == 8] = 214
# data[data % 10 == 9] = 232

# data[data < 80] = 0
a = 200
b = 201
c = 400

# data = data[0:a, 0:b, 0:c]
data = data[::2, ::2, ::2] 

print(len(np.unique(data)))

copy = data.copy()

data[(copy % 9 == 0) & (copy != 0)] = 70
data[copy % 9 == 1] = 90
data[copy % 9 == 2] = 110
data[copy % 9 == 3] = 130
data[copy % 9 == 4] = 150
data[copy % 9 == 5] = 170
data[copy % 9 == 6] = 190
data[copy % 9 == 7] = 210
data[copy % 9 == 8] = 230

# data[0:a, 0:320, 0:c] = 0

# data[(data < 155) & (data != 0)] = 130
# data[data > 155] = 230

# # data[copy == 0] = 0
# data[data2 % 9 == 9] = 70
# data[data2 % 9 == 7] = 90
# data[data2 % 9 == 6] = 110
# data[data2 % 9 == 5] = 130
# data[data2 % 9 == 4] = 150
# data[data2 % 9 == 3] = 170
# data[data2 % 9 == 2] = 190
# data[data2 % 9 == 1] = 210
# data[(data2 % 9 == 0) & (data2 != 0)] = 230




# 321
# w = 4
# val = 250
# x = 216
# y = 131
# z = 164

# 000
w = 4
val = 250
x = 167
y = 34
z = 137

# for i in range(x-w, x+w):
#     for j in range(y-w, y+w):
#         for k in range(z-w, z+w):
#             data[i][j][k] = val

# data = data / 65535
# data = (data * 255).astype(np.uint8)
print(data.shape)
data = (data).astype(np.uint8)

print(data.min(), data.max())
print(np.unique(data)[:40])

outFile = f"../../../Downloads/f32_{a}x{b}x{c}_uint8.raw"
data.tofile(outFile)



